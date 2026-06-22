import { supabase } from './supabase';
import { useStore } from '../store/useStore';
import {
  setSyncUser,
  setSuspended,
  pushEntries,
  pushSettings,
  type SettingsSnapshot,
} from './sync';
import type { FoodEntry } from '../types';

// Guard against re-running a full sync for the same user on repeated
// auth events (token refresh, etc.).
let lastSyncedUser: string | null = null;

function snapshot(): SettingsSnapshot {
  const s = useStore.getState();
  return {
    goals: s.goals,
    waterGoal: s.waterGoal,
    waterIncrement: s.waterIncrement,
    bodyWeightLbs: s.bodyWeightLbs,
    recentFoods: s.recentFoods,
    waterIntake: s.waterIntake,
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
    const [{ data: settings }, { data: rows, error }] = await Promise.all([
      supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('food_entries').select('*').eq('user_id', userId),
    ]);
    if (error) {
      console.warn('[sync] login fetch failed:', error.message);
    }

    const remoteEmpty = !settings && (!rows || rows.length === 0);

    if (remoteEmpty) {
      // First sign-in on this account — migrate whatever is local up to the cloud.
      setSuspended(false);
      const local = useStore.getState();
      const allEntries = Object.values(local.logs).flat();
      await Promise.all([pushSettings(snapshot()), pushEntries(allEntries)]);
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

    useStore.setState((state) => ({
      logs,
      goals: settings?.goals ?? state.goals,
      waterGoal: settings?.water_goal ?? state.waterGoal,
      waterIncrement: settings?.water_increment ?? state.waterIncrement,
      bodyWeightLbs: settings?.body_weight_lbs ?? state.bodyWeightLbs,
      recentFoods: settings?.recent_foods ?? state.recentFoods,
      waterIntake: settings?.water_intake ?? state.waterIntake,
    }));
  } finally {
    setSuspended(false);
  }
}

export function syncOnLogout(): void {
  lastSyncedUser = null;
  setSyncUser(null);
}
