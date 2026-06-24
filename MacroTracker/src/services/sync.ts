import { Alert } from 'react-native';
import { supabase } from './supabase';
import type {
  DailyGoals,
  Food,
  FoodEntry,
  WorkoutSession,
  WorkoutTemplate,
} from '../types';

// Surface sync failures once per app session. A persistent problem (tables not
// created, offline, RLS misconfigured) would otherwise fail on every push, so
// we alert the user a single time while still logging every occurrence. The
// flag resets only on app restart.
let syncErrorAlerted = false;

export function reportSyncError(context: string, message?: string): void {
  console.warn(`[sync] ${context} failed:`, message ?? '');
  if (syncErrorAlerted) return;
  syncErrorAlerted = true;
  Alert.alert(
    'Cloud sync problem',
    "Your changes are saved on this device, but couldn't be backed up to the " +
      'cloud. They may not sync to your other devices or survive reinstalling ' +
      'the app until this is resolved. Check your connection, or contact support ' +
      'if it keeps happening.',
    [{ text: 'OK' }]
  );
}

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
  showWaterTracker: boolean;
  autoRestTimer: boolean;
  defaultRestSeconds: number;
  bodyWeightLbs?: number;
  recentFoods: Food[];
  waterIntake: Record<string, number>;
  workoutTemplates: WorkoutTemplate[];
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
  if (error) reportSyncError('pushEntry', error.message);
}

export async function pushEntries(entries: FoodEntry[]): Promise<void> {
  if (!enabled() || entries.length === 0) return;
  const { error } = await supabase
    .from('food_entries')
    .upsert(entries.map(entryRow));
  if (error) reportSyncError('pushEntries', error.message);
}

export async function deleteEntryRemote(entryId: string): Promise<void> {
  if (!enabled()) return;
  const { error } = await supabase
    .from('food_entries')
    .delete()
    .eq('id', entryId)
    .eq('user_id', userId as string);
  if (error) reportSyncError('deleteEntry', error.message);
}

export async function pushSettings(s: SettingsSnapshot): Promise<void> {
  if (!enabled()) return;
  const { error } = await supabase.from('user_settings').upsert({
    user_id: userId,
    goals: s.goals,
    water_goal: s.waterGoal,
    water_increment: s.waterIncrement,
    show_water_tracker: s.showWaterTracker,
    auto_rest_timer: s.autoRestTimer,
    default_rest_seconds: s.defaultRestSeconds,
    body_weight_lbs: s.bodyWeightLbs ?? null,
    recent_foods: s.recentFoods,
    water_intake: s.waterIntake,
    workout_templates: s.workoutTemplates,
    updated_at: new Date().toISOString(),
  });
  if (error) reportSyncError('pushSettings', error.message);
}

// ── Workout history ─────────────────────────────────────────────────────────
// Completed workout sessions live in their own table (one row per session),
// mirroring how food entries are stored — so a session can be upserted or
// deleted individually rather than re-pushing the whole history each time.
function workoutRow(w: WorkoutSession) {
  return {
    id: w.id,
    user_id: userId,
    name: w.name,
    template_id: w.templateId ?? null,
    date: w.date,
    started_at: w.startedAt,
    completed_at: w.completedAt ?? null,
    exercises: w.exercises,
    heart_rate_samples: w.heartRateSamples ?? null,
    updated_at: new Date().toISOString(),
  };
}

export async function pushWorkout(w: WorkoutSession): Promise<void> {
  if (!enabled()) return;
  const { error } = await supabase.from('workouts').upsert(workoutRow(w));
  if (error) reportSyncError('pushWorkout', error.message);
}

export async function pushWorkouts(list: WorkoutSession[]): Promise<void> {
  if (!enabled() || list.length === 0) return;
  const { error } = await supabase.from('workouts').upsert(list.map(workoutRow));
  if (error) reportSyncError('pushWorkouts', error.message);
}

export async function deleteWorkoutRemote(id: string): Promise<void> {
  if (!enabled()) return;
  const { error } = await supabase
    .from('workouts')
    .delete()
    .eq('id', id)
    .eq('user_id', userId as string);
  if (error) reportSyncError('deleteWorkout', error.message);
}
