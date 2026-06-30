import { Platform } from 'react-native';
import {
  updateApplicationContext,
  sendMessage,
  watchEvents,
} from 'react-native-watch-connectivity';

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

// Push the latest snapshot to the watch. `updateApplicationContext` replaces any
// previous context and is delivered even when the watch app is backgrounded —
// ideal for a "latest state" glance. iOS-only and best-effort: if no watch is
// paired or the session isn't ready, we swallow the error.
export function sendWatchContext(ctx: WatchContext): void {
  if (Platform.OS !== 'ios') return;
  try {
    const result = updateApplicationContext(ctx as unknown as Record<string, unknown>);
    if (result && typeof (result as any).catch === 'function') {
      (result as Promise<unknown>).catch(() => {});
    }
  } catch {
    // No paired watch / session unavailable — safe to ignore.
  }
}

// Tell the watch to begin its on-wrist workout (live HR/calories) in step with
// a phone-started workout. Best-effort; only delivered when the watch app is
// reachable.
export function startWatchWorkout(workoutId: string): void {
  if (Platform.OS !== 'ios') return;
  try {
    sendMessage({ command: 'startWorkout', workoutId }, () => {}, () => {});
  } catch {}
}

// Tell the watch to end its workout (when the phone workout finishes).
export function endWatchWorkout(): void {
  if (Platform.OS !== 'ios') return;
  try {
    sendMessage({ command: 'endWorkout' }, () => {}, () => {});
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
