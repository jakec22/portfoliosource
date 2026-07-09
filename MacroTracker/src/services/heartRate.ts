import { Platform } from 'react-native';
import type { HeartRateSample } from '../types';

/**
 * Heart-rate data source for workouts.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * HOW THIS WORKS
 * ─────────────────────────────────────────────────────────────────────────
 * Apple Watch writes heart-rate samples into the iPhone's HealthKit store and
 * this app reads them via @kingstinct/react-native-healthkit — no watchOS app
 * required (see the Tier-1 design notes).
 *
 * The UI is wired against the `HeartRateMonitor` interface below, so the data
 * source is swappable. Three sources are provided:
 *
 *   'healthkit' — real Apple Watch data via HealthKit. DEFAULT. Requires the
 *                 native module + a rebuilt dev client / EAS build (does NOT
 *                 work in Expo Go — there it degrades gracefully to no data).
 *                 Setup is already in place:
 *                   • @kingstinct/react-native-healthkit + react-native-nitro-modules
 *                     are installed.
 *                   • app.json has the config plugin (HealthKit entitlement +
 *                     NSHealthShareUsageDescription).
 *                   • Run `npx expo prebuild --clean` then build (e.g. EAS) to
 *                     produce an installable build with the native module.
 *
 *   'simulated' — generates a realistic wandering BPM with no native deps.
 *                 Handy in Expo Go or the simulator to preview the live bar,
 *                 pulsing heart, and end-of-workout graph.
 *
 *   'off'       — no heart rate. The HR bar/graph simply don't render.
 *
 * Switch sources with the single constant below.
 */
export type HeartRateSource = 'simulated' | 'healthkit' | 'off';
export const HR_SOURCE: HeartRateSource = 'off';

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
    case 'healthkit':
      instance = healthKitMonitor();
      break;
    default:
      instance = offMonitor();
  }
  return instance;
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
