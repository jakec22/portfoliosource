import { Platform, AppState } from 'react-native';
import {
  updateApplicationContext,
  sendMessage,
  transferUserInfo,
  watchEvents,
  getIsPaired,
  getIsWatchAppInstalled,
} from 'react-native-watch-connectivity';
import { startWatchApp } from '@kingstinct/react-native-healthkit';
import type { HeartRateSample } from '../types';

// Today's stats mirrored to the Apple Watch glance. Keys must match what the
// watch's WCSession delegate reads (see targets/watch/content.swift).
export interface WatchContext {
  caloriesConsumed: number;
  calorieGoal: number;
  protein: number;
  proteinGoal: number;
  carbs: number;
  carbsGoal: number;
  fat: number;
  fatGoal: number;
  water: number;
  waterGoal: number;
  updatedAt: number;
}

// Latest daily stats and current workout state are merged into a single
// application context. `updateApplicationContext` is the reliable channel (the
// same one the glance uses): it's queued and delivered when the watch app next
// becomes active, unlike `sendMessage` which needs the watch reachable at the
// exact send instant. We keep the last stats so a workout start/end can re-push
// the full context without losing the glance data.
// Compact per-set/-exercise shape sent to the watch (short keys to stay small).
export interface WatchPlanSet {
  id: string;
  w: number; // weight
  r: number; // reps
  d: number; // durationSeconds
  c: boolean; // completed
}
export interface WatchPlanExercise {
  id: string;
  name: string;
  mode: string; // 'reps' | 'time'
  sets: WatchPlanSet[];
}

let lastStats: WatchContext | null = null;
let workoutState = {
  workoutActive: false,
  workoutId: '',
  workoutStartedAt: 0,
  workoutActivityType: 0, // HKWorkoutActivityType raw value
};
let workoutPlan: WatchPlanExercise[] = [];

// Whether a watch is paired and our watch app is installed. ALL outbound watch
// communication is gated on this. On an iPhone with no paired Apple Watch,
// calling into WatchConnectivity (updateApplicationContext / transferUserInfo /
// sendMessage) or HealthKit's startWatchApp can raise a native exception that
// crashes the whole app — and a native crash can't be caught by a JS try/catch.
// So instead of trying to catch it, we simply never make the call when there's
// no watch to talk to. Flags start false and are filled in asynchronously.
let watchPaired = false;
let watchAppInstalled = false;

function refreshWatchAvailability(): void {
  if (Platform.OS !== 'ios') return;
  try {
    getIsPaired()
      .then((v: boolean) => {
        const was = watchPaired;
        watchPaired = !!v;
        // Flush the latest context once a watch becomes available.
        if (watchPaired && !was) pushContext();
      })
      .catch(() => {});
    getIsWatchAppInstalled()
      .then((v: boolean) => {
        watchAppInstalled = !!v;
      })
      .catch(() => {});
  } catch {
    // Native module missing (e.g. Expo Go) — leave flags false so we no-op.
  }
}

if (Platform.OS === 'ios') {
  refreshWatchAvailability();
  try {
    watchEvents.on('paired', (paired: boolean) => {
      const was = watchPaired;
      watchPaired = !!paired;
      if (watchPaired && !was) pushContext();
    });
    watchEvents.on('installed', (installed: boolean) => {
      watchAppInstalled = !!installed;
    });
  } catch {}
  try {
    AppState.addEventListener('change', (s) => {
      if (s === 'active') refreshWatchAvailability();
    });
  } catch {}
}

function pushContext(): void {
  if (Platform.OS !== 'ios' || !watchPaired) return;
  const ctx: Record<string, unknown> = {
    ...(lastStats ?? {}),
    ...workoutState,
    workoutPlan,
  };
  try {
    const result = updateApplicationContext(ctx);
    if (result && typeof (result as any).catch === 'function') {
      (result as Promise<unknown>).catch(() => {});
    }
  } catch {
    // No paired watch / session unavailable — safe to ignore.
  }
}

export function sendWatchContext(ctx: WatchContext): void {
  lastStats = ctx;
  pushContext();
}

// Push the current workout's exercises + sets to the watch so it can display
// (and, later, check off) them. Pass [] to clear.
export function setWatchWorkoutPlan(plan: WatchPlanExercise[]): void {
  workoutPlan = plan;
  pushContext();
}

// Mark a workout active in the context so the watch starts its on-wrist session
// (live HR/calories) when it next becomes active. Also fire a sendMessage for
// the case where the watch app is already reachable (instant start).
export function startWatchWorkout(workoutId: string, activityType = 0): void {
  if (Platform.OS !== 'ios') return;
  workoutState = {
    workoutActive: true,
    workoutId,
    workoutStartedAt: Date.now(),
    workoutActivityType: activityType,
  };
  pushContext();
  // Nothing below can reach a watch that isn't there — and startWatchApp in
  // particular crashes natively on an unpaired iPhone — so bail out early.
  if (!watchPaired) return;
  // Launch the watch app and start its workout session from the phone (the only
  // Apple-supported way to open a watch app remotely). The watch handles the
  // delivered configuration in its app delegate. Falls back gracefully — the
  // context + message paths still drive the watch if it's already open.
  if (watchAppInstalled) {
    try {
      startWatchApp({ activityType: (activityType || 50) as any })?.catch?.(() => {});
    } catch {}
  }
  try {
    sendMessage(
      { command: 'startWorkout', workoutId, workoutActivityType: activityType },
      () => {},
      () => {}
    );
  } catch {}
}

// Clear the active workout (when the phone workout finishes/cancels).
export function endWatchWorkout(): void {
  if (Platform.OS !== 'ios') return;
  workoutState = {
    workoutActive: false,
    workoutId: '',
    workoutStartedAt: 0,
    workoutActivityType: 0,
  };
  workoutPlan = [];
  pushContext();
  if (!watchPaired) return;
  try {
    sendMessage({ command: 'endWorkout' }, () => {}, () => {});
  } catch {}
}

// Mirror the rest countdown to the watch using a shared end timestamp. Uses
// transferUserInfo (not sendMessage): it's queued and delivered reliably even
// when the watch screen is off / app is backgrounded — which is exactly the
// case when you tap a set on the phone with your wrist down. The watch computes
// the remaining time from the absolute endAt, so a second or two of delivery
// latency doesn't desync the countdown.
export function startWatchRest(endAt: number): void {
  if (Platform.OS !== 'ios' || !watchPaired) return;
  try {
    transferUserInfo({ type: 'rest', endAt });
  } catch {}
}

// Clear the watch rest countdown without buzzing (e.g. the user skipped rest).
export function stopWatchRest(): void {
  if (Platform.OS !== 'ios' || !watchPaired) return;
  try {
    transferUserInfo({ type: 'restStop' });
  } catch {}
}

// Subscribe to set check-offs coming from the watch. Delivered via the watch's
// sendMessage (the 'message' event — same proven path as HR streaming).
export function subscribeWatchSetToggle(
  cb: (exerciseId: string, setId: string, completed: boolean) => void
): () => void {
  if (Platform.OS !== 'ios') return () => {};
  const unsubscribe = watchEvents.on('message', (message: any) => {
    if (
      message?.type === 'toggleSet' &&
      typeof message.exerciseId === 'string' &&
      typeof message.setId === 'string'
    ) {
      cb(message.exerciseId, message.setId, !!message.completed);
    }
  });
  return () => {
    try {
      unsubscribe();
    } catch {}
  };
}

// Subscribe to a "finish workout" command from the watch (Complete Workout
// button). Returns an unsubscribe function.
export function subscribeWatchWorkoutFinish(
  cb: (completeAll: boolean) => void
): () => void {
  if (Platform.OS !== 'ios') return () => {};
  const unsubscribe = watchEvents.on('message', (message: any) => {
    if (message?.type === 'finishWorkout') cb(!!message.completeAll);
  });
  return () => {
    try {
      unsubscribe();
    } catch {}
  };
}

// ── Workout heart-rate buffer ────────────────────────────────────────────
// Samples streamed from the watch during the current workout, kept at module
// scope (not in a React ref) so they survive the ActiveWorkout screen being
// unmounted. The watch can finish a workout while the phone is on another
// screen (or its screen is off), and we still need these to attach to the
// saved session for the history graph.
let workoutHrBuffer: HeartRateSample[] = [];

export function addWorkoutHrSample(sample: HeartRateSample): void {
  workoutHrBuffer.push(sample);
}

export function getWorkoutHrSamples(): HeartRateSample[] {
  return workoutHrBuffer.slice();
}

export function resetWorkoutHrBuffer(): void {
  workoutHrBuffer = [];
}

// Subscribe to live heart-rate samples streamed from the watch during a
// workout. Returns an unsubscribe function.
export function subscribeWatchHeartRate(
  cb: (bpm: number, timestamp: number) => void
): () => void {
  if (Platform.OS !== 'ios') return () => {};
  const unsubscribe = watchEvents.on('message', (message: any) => {
    if (message?.type === 'heartRate' && typeof message.bpm === 'number') {
      const ts = typeof message.timestamp === 'number' ? message.timestamp : Date.now();
      cb(message.bpm, ts);
    }
  });
  return () => {
    try {
      unsubscribe();
    } catch {}
  };
}
