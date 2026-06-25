import { supabase } from './supabase';
import { useStore } from '../store/useStore';
import {
  setSyncUser,
  setSuspended,
  pushEntries,
  pushSettings,
  pushWorkouts,
  reportSyncError,
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
    bodyWeightLog: s.bodyWeightLog,
    recentFoods: s.recentFoods,
    favoriteFoods: s.favoriteFoods,
    customFoods: s.customFoods,
    savedMeals: s.savedMeals,
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

// zustand's persist middleware rehydrates the store from AsyncStorage
// asynchronously. syncOnLogin reads local state to decide what to push up, so
// it must wait for rehydration to finish first — otherwise it reads the initial
// empty state, uploads nothing, and may overwrite good local data with cloud.
async function waitForStoreHydration(): Promise<void> {
  if (useStore.persist.hasHydrated()) return;
  await new Promise<void>((resolve) => {
    const unsub = useStore.persist.onFinishHydration(() => {
      unsub();
      resolve();
    });
    // Guard the gap between the check above and subscribing.
    if (useStore.persist.hasHydrated()) {
      unsub();
      resolve();
    }
  });
}

/**
 * Reconcile local and remote state when a user signs in.
 * - Brand-new account (nothing in the cloud): push the current local state up.
 * - Existing account: pull the cloud state down, replacing local.
 */
export async function syncOnLogin(userId: string): Promise<void> {
  if (lastSyncedUser === userId) return;
  lastSyncedUser = userId;

  // Ensure the local store is fully loaded from disk before we read it to
  // decide what to migrate up to the cloud.
  await waitForStoreHydration();

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
      reportSyncError('login fetch', error.message);
    }
    if (workoutErr) {
      reportSyncError('login workout fetch', workoutErr.message);
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

    // Existing account — food entries and settings come from the cloud.
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

    // Workouts: merge local and cloud bidirectionally.
    // Local sessions not yet in the cloud are pushed up — this handles the
    // one-time transition for users who had workouts before sync was added,
    // and sessions logged while offline. Cloud sessions absent from this
    // device are pulled down for multi-device use.
    const cloudWorkouts = (workoutRows ?? []).map(rowToWorkout);
    const cloudIds = new Set(cloudWorkouts.map((w) => w.id));
    const localWorkouts = useStore.getState().workoutHistory;
    const localOnly = localWorkouts.filter((w) => !cloudIds.has(w.id));

    if (localOnly.length > 0) {
      setSuspended(false);
      await pushWorkouts(localOnly);
      setSuspended(true);
    }

    const localIds = new Set(localWorkouts.map((w) => w.id));
    const mergedWorkoutHistory = [
      ...localWorkouts,
      ...cloudWorkouts.filter((w) => !localIds.has(w.id)),
    ]
      .sort((a, b) => (b.completedAt ?? b.startedAt) - (a.completedAt ?? a.startedAt))
      .slice(0, 100);

    useStore.setState((state) => ({
      logs,
      goals: settings?.goals ?? state.goals,
      waterGoal: settings?.water_goal ?? state.waterGoal,
      waterIncrement: settings?.water_increment ?? state.waterIncrement,
      showWaterTracker: settings?.show_water_tracker ?? state.showWaterTracker,
      autoRestTimer: settings?.auto_rest_timer ?? state.autoRestTimer,
      defaultRestSeconds: settings?.default_rest_seconds ?? state.defaultRestSeconds,
      bodyWeightLbs: settings?.body_weight_lbs ?? state.bodyWeightLbs,
      waterIntake: settings?.water_intake ?? state.waterIntake,
      // For list-valued settings, only take the cloud copy when it actually has
      // items — an empty/missing cloud array must not wipe local data (e.g. a
      // settings row written before templates/foods existed).
      recentFoods: settings?.recent_foods?.length
        ? settings.recent_foods
        : state.recentFoods,
      favoriteFoods: settings?.favorite_foods?.length
        ? settings.favorite_foods
        : state.favoriteFoods,
      customFoods: settings?.custom_foods?.length
        ? settings.custom_foods
        : state.customFoods,
      savedMeals: settings?.saved_meals?.length
        ? settings.saved_meals
        : state.savedMeals,
      bodyWeightLog: settings?.body_weight_log?.length
        ? settings.body_weight_log
        : state.bodyWeightLog,
      workoutTemplates: settings?.workout_templates?.length
        ? settings.workout_templates
        : state.workoutTemplates,
      workoutHistory: mergedWorkoutHistory,
    }));

    // The cloud settings row may be incomplete or stale (older schema, or
    // written before templates/recent foods existed). Push the now-merged
    // snapshot back up so the cloud self-heals to a complete row.
    setSuspended(false);
    await pushSettings(snapshot());
  } finally {
    setSuspended(false);
  }
}

export function syncOnLogout(): void {
  lastSyncedUser = null;
  setSyncUser(null);
}
