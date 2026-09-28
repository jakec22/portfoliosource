import { Platform } from 'react-native';
import type { HeartRateSample } from '../types';

/**
 * Heart-rate data source for workouts.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * HOW THIS WORKS
 * ─────────────────────────────────────────────────────────────────────────
 * The app never talks to a watch directly. A wearable writes heart rate into
 * the phone's health store and this reads it back out — HealthKit on iOS (fed
 * by Apple Watch), Health Connect on Android (fed by Wear OS, Galaxy Watch,
 * Fitbit, Whoop, or the phone's own sensors, whichever the user already has).
 *
 * Everything upstream is wired against the `HeartRateMonitor` interface below
 * and never learns which store it got. Three sources:
 *
 *   'platform'  — the real one. DEFAULT. HealthKit on iOS, Health Connect on
 *                 Android, nothing anywhere else. Needs the native modules, so
 *                 it produces no data in Expo Go; it degrades rather than
 *                 throwing. iOS carries the HealthKit config plugin and its
 *                 usage strings; Android carries react-native-health-connect's
 *                 plugin and the READ_HEART_RATE permission. Both are in
 *                 app.json — run `npx expo prebuild --clean` and rebuild after
 *                 changing either.
 *
 *   'simulated' — a realistic wandering BPM with no native deps. Handy in
 *                 Expo Go or a simulator to preview the live readout and the
 *                 end-of-workout zone graph.
 *
 *   'off'       — no heart rate. The HR readout and graph don't render.
 *
 * Switch sources with the single constant below.
 */
export type HeartRateSource = 'simulated' | 'platform' | 'off';
export const HR_SOURCE: HeartRateSource = 'platform';

// HealthKit identifiers/units (string constants — see the library's typings).
const HR_IDENTIFIER = 'HKQuantityTypeIdentifierHeartRate' as const;
const HR_UNIT = 'count/min' as const;

export interface HeartRateMonitor {
  /** Whether this source can produce data on the current device/build. */
  available: boolean;
  /** Ask the user for read permission (HealthKit). Resolves true if granted. */
  requestPermissions(): Promise<boolean>;
  /** Begin delivering live samples via the callback. */
  start(onSample: (sample: HeartRateSample) => void): void;
  /** Stop live delivery and release resources. */
  stop(): void;
  /**
   * Batch-query all samples in a time window — used at the end of a workout
   * to pull the densest, most accurate series. Returns [] if unsupported.
   */
  query(startMs: number, endMs: number): Promise<HeartRateSample[]>;
}

// ── Simulated source ───────────────────────────────────────────────────────
// A gentle random walk that looks like lifting: a resting baseline that drifts
// up during "effort" and recovers, staying within a believable band.
function simulatedMonitor(): HeartRateMonitor {
  let timer: ReturnType<typeof setInterval> | null = null;
  let bpm = 78;
  let target = 110;

  return {
    available: true,
    async requestPermissions() {
      return true;
    },
    start(onSample) {
      this.stop();
      const tick = () => {
        // Occasionally pick a new target (set in progress vs. resting).
        if (Math.random() < 0.25) {
          target = 80 + Math.round(Math.random() * 80); // 80–160
        }
        // Ease toward the target with a little noise.
        bpm += (target - bpm) * 0.25 + (Math.random() * 6 - 3);
        bpm = Math.max(60, Math.min(185, bpm));
        onSample({ timestamp: Date.now(), bpm: Math.round(bpm) });
      };
      tick();
      timer = setInterval(tick, 3000);
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
    async query() {
      // Simulator has no store to query — the live samples collected during
      // the workout are used for the graph instead.
      return [];
    },
  };
}

// ── HealthKit source (real Apple Watch data) ───────────────────────────────
// Reads heart rate from the iPhone's Health store via
// @kingstinct/react-native-healthkit. The module is loaded lazily and every
// call is guarded, so on a build/runtime without the native module (e.g. Expo
// Go) this degrades to "no data" rather than crashing.
function healthKitMonitor(): HeartRateMonitor {
  let hk: typeof import('@kingstinct/react-native-healthkit') | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    hk = require('@kingstinct/react-native-healthkit');
  } catch (e) {
    // The native module isn't in this build (e.g. Expo Go, or `pod install`
    // hasn't been run since the package was added). We degrade to no data.
    // This log is the quickest way to confirm that's what's happening.
    if (__DEV__) {
      console.warn(
        '[heartRate] @kingstinct/react-native-healthkit failed to load — ' +
          'HR will show no data. Run `npx pod-install` and rebuild. Details:',
        e
      );
    }
    return offMonitor();
  }
  if (!hk) return offMonitor();
  const HK = hk;
  if (__DEV__) {
    let avail = false;
    try {
      avail = Platform.OS === 'ios' && HK.isHealthDataAvailable();
    } catch {
      avail = false;
    }
    console.log(`[heartRate] HealthKit module loaded. healthDataAvailable=${avail}`);
  }

  let poll: ReturnType<typeof setInterval> | null = null;
  let subscription: { remove: () => boolean } | null = null;
  let lastTs = 0;

  const available = (() => {
    try {
      return Platform.OS === 'ios' && HK.isHealthDataAvailable();
    } catch {
      return false;
    }
  })();

  // Read the most recent HR sample and emit it (deduped by timestamp).
  async function pull(onSample: (sample: HeartRateSample) => void) {
    try {
      const s = await HK.getMostRecentQuantitySample(HR_IDENTIFIER, HR_UNIT);
      if (!s) return;
      const ts = +new Date(s.endDate);
      if (ts === lastTs) return; // same reading as last time — skip
      lastTs = ts;
      onSample({ timestamp: ts, bpm: Math.round(s.quantity) });
    } catch {
      // ignore transient read errors
    }
  }

  return {
    available,
    async requestPermissions() {
      try {
        const granted = await HK.requestAuthorization({ toRead: [HR_IDENTIFIER] });
        if (__DEV__) console.log(`[heartRate] requestAuthorization -> ${granted}`);
        return granted;
      } catch (e) {
        if (__DEV__) console.warn('[heartRate] requestAuthorization threw:', e);
        return false;
      }
    },
    start(onSample) {
      this.stop();
      lastTs = 0;
      void pull(onSample);
      // Poll for the live readout, and also refetch promptly when HealthKit
      // signals that new heart-rate data has landed from the Watch.
      poll = setInterval(() => void pull(onSample), 5000);
      try {
        subscription = HK.subscribeToChanges(HR_IDENTIFIER, () => void pull(onSample));
      } catch {
        subscription = null;
      }
    },
    stop() {
      if (poll) clearInterval(poll);
      poll = null;
      if (subscription) {
        try {
          subscription.remove();
        } catch {
          // ignore
        }
        subscription = null;
      }
    },
    async query(startMs, endMs) {
      try {
        const samples = await HK.queryQuantitySamples(HR_IDENTIFIER, {
          filter: { date: { startDate: new Date(startMs), endDate: new Date(endMs) } },
          limit: -1, // all samples in the window
          ascending: true,
          unit: HR_UNIT,
        });
        return samples.map((s) => ({
          timestamp: +new Date(s.endDate),
          bpm: Math.round(s.quantity),
        }));
      } catch {
        return [];
      }
    },
  };
}

// ── Health Connect source (Android) ────────────────────────────────────────
// The Android counterpart to HealthKit. Health Connect is the aggregator every
// Wear OS / Galaxy Watch / Fitbit app writes into, so this picks up whatever
// the user already wears without HolyMacro talking to any of them directly.
//
// Two shape differences from HealthKit worth knowing:
//   * There is no live subscription, so the readout polls. HealthKit's
//     subscribeToChanges has no equivalent here.
//   * Heart rate arrives as *records* that each hold many samples, rather than
//     one sample per row, so every read flattens before it can be used.
function healthConnectMonitor(): HeartRateMonitor {
  let hc: typeof import('react-native-health-connect') | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    hc = require('react-native-health-connect');
  } catch (e) {
    if (__DEV__) {
      console.warn(
        '[heartRate] react-native-health-connect failed to load — HR will ' +
          'show no data. Rebuild the dev client. Details:',
        e
      );
    }
    return offMonitor();
  }
  if (!hc) return offMonitor();
  const HC = hc;

  let poll: ReturnType<typeof setInterval> | null = null;
  let lastTs = 0;
  let initialized = false;

  // initialize() has to succeed before any read, and it fails on devices where
  // Health Connect isn't installed or is too old to use.
  async function ready(): Promise<boolean> {
    if (initialized) return true;
    try {
      const status = await HC.getSdkStatus();
      if (status !== HC.SdkAvailabilityStatus.SDK_AVAILABLE) {
        if (__DEV__) console.log(`[heartRate] Health Connect sdkStatus=${status}`);
        return false;
      }
      initialized = await HC.initialize();
      return initialized;
    } catch {
      return false;
    }
  }

  function between(startMs: number, endMs: number) {
    return {
      operator: 'between' as const,
      startTime: new Date(startMs).toISOString(),
      endTime: new Date(endMs).toISOString(),
    };
  }

  /** Every bpm reading in the window, oldest first. */
  async function readRange(startMs: number, endMs: number): Promise<HeartRateSample[]> {
    if (!(await ready())) return [];
    try {
      const { records } = await HC.readRecords('HeartRate', {
        timeRangeFilter: between(startMs, endMs),
        ascendingOrder: true,
      });
      const out: HeartRateSample[] = [];
      for (const record of records) {
        for (const s of record.samples) {
          out.push({ timestamp: +new Date(s.time), bpm: Math.round(s.beatsPerMinute) });
        }
      }
      // Records can overlap when two sources write, so sorting the flattened
      // samples matters even though the records themselves came back ordered.
      return out.sort((a, b) => a.timestamp - b.timestamp);
    } catch {
      return [];
    }
  }

  return {
    available: Platform.OS === 'android',
    async requestPermissions() {
      if (!(await ready())) return false;
      try {
        const granted = await HC.requestPermission([
          { accessType: 'read', recordType: 'HeartRate' },
        ]);
        return granted.some(
          (p) => 'recordType' in p && p.recordType === 'HeartRate' && p.accessType === 'read'
        );
      } catch {
        return false;
      }
    },
    start(onSample) {
      this.stop();
      lastTs = 0;
      // Look back a little so the readout has something the moment a workout
      // opens, rather than staying blank until the next write lands.
      const tick = async () => {
        const samples = await readRange(Date.now() - 60_000, Date.now());
        const latest = samples[samples.length - 1];
        if (!latest || latest.timestamp === lastTs) return;
        lastTs = latest.timestamp;
        onSample(latest);
      };
      void tick();
      poll = setInterval(() => void tick(), 5000);
    },
    stop() {
      if (poll) clearInterval(poll);
      poll = null;
    },
    query(startMs, endMs) {
      return readRange(startMs, endMs);
    },
  };
}

// ── Off source ─────────────────────────────────────────────────────────────
function offMonitor(): HeartRateMonitor {
  return {
    available: false,
    async requestPermissions() {
      return false;
    },
    start() {},
    stop() {},
    async query() {
      return [];
    },
  };
}

let instance: HeartRateMonitor | null = null;

/** Returns the configured heart-rate monitor (singleton). */
export function getHeartRateMonitor(): HeartRateMonitor {
  if (instance) return instance;
  switch (HR_SOURCE) {
    case 'simulated':
      instance = simulatedMonitor();
      break;
    case 'platform':
      // One constant, two native stores: HealthKit on iOS, Health Connect on
      // Android. Both satisfy the same interface, so nothing above this line
      // knows which one it got.
      instance =
        Platform.OS === 'ios'
          ? healthKitMonitor()
          : Platform.OS === 'android'
            ? healthConnectMonitor()
            : offMonitor();
      break;
    default:
      instance = offMonitor();
  }
  return instance;
}

/**
 * Reduce a dense heart-rate series to at most `maxPoints` samples for storage.
 * A workout can stream thousands of samples; persisting all of them for every
 * saved workout bloats the on-disk store and slows app cold-start. `maxPoints`
 * (~200) is far more than a small phone chart can resolve, and we always keep
 * the first, last, and the true peak/low samples so the graph shape and the
 * Avg/Peak/Low stats stay accurate.
 */
export function downsampleHeartRate(
  samples: HeartRateSample[],
  maxPoints = 200
): HeartRateSample[] {
  if (samples.length <= maxPoints) return samples;
  const step = samples.length / maxPoints;
  const picked = new Set<number>();
  for (let i = 0; i < maxPoints; i++) picked.add(Math.floor(i * step));
  picked.add(samples.length - 1); // reach the end of the workout
  // Preserve the extremes so peak/low stats aren't softened by sampling.
  let peakI = 0;
  let lowI = 0;
  for (let i = 1; i < samples.length; i++) {
    if (samples[i].bpm > samples[peakI].bpm) peakI = i;
    if (samples[i].bpm < samples[lowI].bpm) lowI = i;
  }
  picked.add(peakI);
  picked.add(lowI);
  return Array.from(picked)
    .sort((a, b) => a - b)
    .map((i) => samples[i]);
}

/** Convenience: average / peak / low for a set of samples. */
export function heartRateStats(samples: HeartRateSample[]) {
  if (samples.length === 0) return null;
  let sum = 0;
  let peak = -Infinity;
  let low = Infinity;
  for (const s of samples) {
    sum += s.bpm;
    if (s.bpm > peak) peak = s.bpm;
    if (s.bpm < low) low = s.bpm;
  }
  return {
    avg: Math.round(sum / samples.length),
    peak: Math.round(peak),
    low: Math.round(low),
  };
}
