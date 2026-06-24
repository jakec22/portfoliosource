import { supabase } from './supabase';
import { useStore } from '../store/useStore';
import {
  setSyncUser,
  setSuspended,
  pushEntries,
  pushSettings,
  pushWorkouts,
  type SettingsSnapshot,
} from './sync';
import type { FoodEntry, WorkoutSession } from '../types';

// Guard against re-running a full sync for the same user on repeated
// auth events (token refresh, etc.).
let lastSyncedUser: string | null = null;

function snapshot(): SettingsSnapshot {
  const s = useStore.getState();
  return {
    goals: s.goals,
    waterGoal: s.waterGoal,
    waterIncrement: s.waterIncrement,
    showWaterTracker: s.showWaterTracker,
    autoRestTimer: s.autoRestTimer,
    defaultRestSeconds: s.defaultRestSeconds,
    bodyWeightLbs: s.bodyWeightLbs,
    recentFoods: s.recentFoods,
    waterIntake: s.waterIntake,
    workoutTemplates: s.workoutTemplates,
  };
}

// Map a `workouts` table row back into a WorkoutSession.
function rowToWorkout(row: any): WorkoutSession {
  return {
    id: row.id,
    name: row.name,
    templateId: row.template_id ?? undefined,
    date: row.date,
    startedAt: Number(row.started_at),
    completedAt: row.completed_at != null ? Number(row.completed_at) : undefined,
    exercises: row.exercises ?? [],
    heartRateSamples: row.heart_rate_samples ?? undefined,
  };
}

/**
 * Reconcile local and remote state when a user signs in.
 * - Brand-new account (nothing in the cloud): push the current local state up.
 * - Existing account: pull the cloud state down, replacing local.
 */
export async function syncOnLogin(userId: string): Promise<void> {
  if (lastSyncedUser === userId) return;
  lastSyncedUser = userId;

  setSuspended(true);
  setSyncUser(userId);
  try {
    const [
      { data: settings },
      { data: rows, error },
      { data: workoutRows, error: workoutErr },
    ] = await Promise.all([
      supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('food_entries').select('*').eq('user_id', userId),
      supabase.from('workouts').select('*').eq('user_id', userId),
    ]);
    if (error) {
      console.warn('[sync] login fetch failed:', error.message);
    }
    if (workoutErr) {
      console.warn('[sync] login workout fetch failed:', workoutErr.message);
    }

    const remoteEmpty =
      !settings &&
      (!rows || rows.length === 0) &&
      (!workoutRows || workoutRows.length === 0);

    if (remoteEmpty) {
      // First sign-in on this account — migrate whatever is local up to the cloud.
      setSuspended(false);
      const local = useStore.getState();
      const allEntries = Object.values(local.logs).flat();
      await Promise.all([
        pushSettings(snapshot()),
        pushEntries(allEntries),
        pushWorkouts(local.workoutHistory),
      ]);
      return;
    }

    // Existing account — pull remote state into the store.
    const logs: Record<string, FoodEntry[]> = {};
    (rows ?? []).forEach((row: any) => {
      const entry: FoodEntry = {
        id: row.id,
        food: row.food,
        servings: Number(row.servings),
        amount: row.amount != null ? Number(row.amount) : undefined,
        unit: row.unit ?? undefined,
        meal: row.meal,
        timestamp: Number(row.timestamp_ms) || Date.now(),
        date: row.date,
      };
      (logs[row.date] ??= []).push(entry);
    });

    // Completed sessions, newest first (matching the store's invariant).
    const workoutHistory = (workoutRows ?? [])
      .map(rowToWorkout)
      .sort(
        (a, b) =>
          (b.completedAt ?? b.startedAt) - (a.completedAt ?? a.startedAt)
      );

    useStore.setState((state) => ({
      logs,
      goals: settings?.goals ?? state.goals,
      waterGoal: settings?.water_goal ?? state.waterGoal,
      waterIncrement: settings?.water_increment ?? state.waterIncrement,
      showWaterTracker: settings?.show_water_tracker ?? state.showWaterTracker,
      autoRestTimer: settings?.auto_rest_timer ?? state.autoRestTimer,
      defaultRestSeconds: settings?.default_rest_seconds ?? state.defaultRestSeconds,
      bodyWeightLbs: settings?.body_weight_lbs ?? state.bodyWeightLbs,
      recentFoods: settings?.recent_foods ?? state.recentFoods,
      waterIntake: settings?.water_intake ?? state.waterIntake,
      workoutTemplates: settings?.workout_templates ?? state.workoutTemplates,
      workoutHistory,
    }));
  } finally {
    setSuspended(false);
  }
}

export function syncOnLogout(): void {
  lastSyncedUser = null;
  setSyncUser(null);
}
