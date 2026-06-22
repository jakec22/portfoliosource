import { supabase } from './supabase';
import type { DailyGoals, Food, FoodEntry } from '../types';

// While hydrating from the cloud we suspend pushes so writing the freshly
// pulled state back into the store doesn't echo straight back to the server.
let suspended = false;
let userId: string | null = null;

export function setSyncUser(id: string | null) {
  userId = id;
}

export function setSuspended(v: boolean) {
  suspended = v;
}

function enabled(): boolean {
  return !suspended && !!userId;
}

export interface SettingsSnapshot {
  goals: DailyGoals;
  waterGoal: number;
  waterIncrement: number;
  bodyWeightLbs?: number;
  recentFoods: Food[];
  waterIntake: Record<string, number>;
}

function entryRow(entry: FoodEntry) {
  return {
    id: entry.id,
    user_id: userId,
    date: entry.date,
    meal: entry.meal,
    food: entry.food,
    servings: entry.servings,
    amount: entry.amount ?? null,
    unit: entry.unit ?? null,
    timestamp_ms: entry.timestamp,
    updated_at: new Date().toISOString(),
  };
}

export async function pushEntry(entry: FoodEntry): Promise<void> {
  if (!enabled()) return;
  const { error } = await supabase.from('food_entries').upsert(entryRow(entry));
  if (error) console.warn('[sync] pushEntry failed:', error.message);
}

export async function pushEntries(entries: FoodEntry[]): Promise<void> {
  if (!enabled() || entries.length === 0) return;
  const { error } = await supabase
    .from('food_entries')
    .upsert(entries.map(entryRow));
  if (error) console.warn('[sync] pushEntries failed:', error.message);
}

export async function deleteEntryRemote(entryId: string): Promise<void> {
  if (!enabled()) return;
  const { error } = await supabase
    .from('food_entries')
    .delete()
    .eq('id', entryId)
    .eq('user_id', userId as string);
  if (error) console.warn('[sync] deleteEntry failed:', error.message);
}

export async function pushSettings(s: SettingsSnapshot): Promise<void> {
  if (!enabled()) return;
  const { error } = await supabase.from('user_settings').upsert({
    user_id: userId,
    goals: s.goals,
    water_goal: s.waterGoal,
    water_increment: s.waterIncrement,
    body_weight_lbs: s.bodyWeightLbs ?? null,
    recent_foods: s.recentFoods,
    water_intake: s.waterIntake,
    updated_at: new Date().toISOString(),
  });
  if (error) console.warn('[sync] pushSettings failed:', error.message);
}
