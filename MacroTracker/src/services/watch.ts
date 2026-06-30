import { Platform } from 'react-native';
import {
  updateApplicationContext,
  sendMessage,
  transferUserInfo,
  watchEvents,
} from 'react-native-watch-connectivity';
import { startWatchApp } from '@kingstinct/react-native-healthkit';

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
let lastStats: WatchContext | null = null;
let workoutState = {
  workoutActive: false,
  workoutId: '',
  workoutStartedAt: 0,
  workoutActivityType: 0, // HKWorkoutActivityType raw value
};

function pushContext(): void {
  if (Platform.OS !== 'ios') return;
  const ctx: Record<string, unknown> = { ...(lastStats ?? {}), ...workoutState };
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
  // Launch the watch app and start its workout session from the phone (the only
  // Apple-supported way to open a watch app remotely). The watch handles the
  // delivered configuration in its app delegate. Falls back gracefully — the
  // context + message paths still drive the watch if it's already open.
  try {
    startWatchApp({ activityType: (activityType || 50) as any })?.catch?.(() => {});
  } catch {}
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
  pushContext();
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
  if (Platform.OS !== 'ios') return;
  try {
    transferUserInfo({ type: 'rest', endAt });
  } catch {}
}

// Clear the watch rest countdown without buzzing (e.g. the user skipped rest).
export function stopWatchRest(): void {
  if (Platform.OS !== 'ios') return;
  try {
    transferUserInfo({ type: 'restStop' });
  } catch {}
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
