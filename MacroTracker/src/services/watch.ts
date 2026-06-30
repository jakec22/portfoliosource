import { Platform } from 'react-native';
import { updateApplicationContext } from 'react-native-watch-connectivity';

// Today's stats mirrored to the Apple Watch glance. Keys must match what the
// watch's WCSession delegate reads (see targets/watch/content.swift).
export interface WatchContext {
  caloriesConsumed: number;
  calorieGoal: number;
  protein: number;
  carbs: number;
  fat: number;
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
