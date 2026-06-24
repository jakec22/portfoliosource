import type { HeartRateSample } from '../types';

/**
 * Heart-rate data source for workouts.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * HOW THIS WORKS / HOW TO ENABLE REAL APPLE WATCH DATA
 * ─────────────────────────────────────────────────────────────────────────
 * Apple Watch writes heart-rate samples into the iPhone's HealthKit store.
 * This app reads them — no watchOS app required (see the Tier-1 design notes).
 *
 * The UI is wired against the `HeartRateMonitor` interface below, so the data
 * source is swappable. Three sources are provided:
 *
 *   'simulated' — generates a realistic wandering BPM with no native deps.
 *                 Lets you see the live bar, pulsing heart, and end-of-workout
 *                 graph working immediately in Expo Go / any build. DEFAULT.
 *
 *   'healthkit' — real Apple Watch data via HealthKit. Requires a native
 *                 module + a rebuilt dev client (does NOT work in Expo Go):
 *                   1. npm install @kingstinct/react-native-healthkit
 *                   2. app.json → add the config plugin + HealthKit entitlement
 *                      and NSHealthShareUsageDescription Info.plist string.
 *                   3. npx expo prebuild && rebuild the dev client / EAS build.
 *                   4. Uncomment the implementation in `healthKitMonitor()`
 *                      below and set HR_SOURCE = 'healthkit'.
 *
 *   'off'       — no heart rate. The HR bar/graph simply don't render.
 *
 * Switch sources with the single constant below.
 */
export type HeartRateSource = 'simulated' | 'healthkit' | 'off';
export const HR_SOURCE: HeartRateSource = 'simulated';

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
// Left as a no-op until the native module is installed (see header). When you
// install @kingstinct/react-native-healthkit, replace the body below with the
// commented reference implementation and set HR_SOURCE = 'healthkit'.
function healthKitMonitor(): HeartRateMonitor {
  // import {
  //   isHealthDataAvailable,
  //   requestAuthorization,
  //   queryQuantitySamples,
  //   subscribeToChanges,
  //   HKQuantityTypeIdentifier,
  // } from '@kingstinct/react-native-healthkit';
  //
  // let unsubscribe: (() => void) | null = null;
  // let poll: ReturnType<typeof setInterval> | null = null;
  // return {
  //   available: isHealthDataAvailable(),
  //   async requestPermissions() {
  //     await requestAuthorization([HKQuantityTypeIdentifier.heartRate], []);
  //     return true;
  //   },
  //   start(onSample) {
  //     // Poll the most recent sample every 5s for the live readout.
  //     const pull = async () => {
  //       const [latest] = await queryQuantitySamples(
  //         HKQuantityTypeIdentifier.heartRate,
  //         { limit: 1, ascending: false }
  //       );
  //       if (latest) onSample({ timestamp: +new Date(latest.endDate), bpm: Math.round(latest.quantity) });
  //     };
  //     pull();
  //     poll = setInterval(pull, 5000);
  //   },
  //   stop() {
  //     if (poll) clearInterval(poll);
  //     if (unsubscribe) unsubscribe();
  //     poll = null; unsubscribe = null;
  //   },
  //   async query(startMs, endMs) {
  //     const samples = await queryQuantitySamples(HKQuantityTypeIdentifier.heartRate, {
  //       filter: { startDate: new Date(startMs), endDate: new Date(endMs) },
  //       ascending: true,
  //     });
  //     return samples.map((s) => ({ timestamp: +new Date(s.endDate), bpm: Math.round(s.quantity) }));
  //   },
  // };
  return offMonitor();
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
    peak,
    low,
  };
}
