import { Alert } from 'react-native';
import { supabase } from './supabase';
import type {
  AppState,
  BodyWeightEntry,
  DailyGoals,
  RecoveryPreset,
  Food,
  FoodEntry,
  SavedMeal,
  ThemeMode,
  UserProfile,
  WorkoutSession,
  WorkoutTemplate,
} from '../types';
import type { RecoveryKind } from '../utils/workoutTypes';

// Surface sync failures once per app session. A persistent problem (tables not
// created, offline, RLS misconfigured) would otherwise fail on every push, so
// we alert the user a single time while still logging every occurrence. The
// flag resets only on app restart.
let syncErrorAlerted = false;

/**
 * Name the missing column when Postgres rejects a write for not having one.
 *
 * Every table here is written as a whole row, so one column the database does
 * not have fails the entire write — goals, templates and water all stop
 * syncing because of one new field. That has happened twice (see the notes in
 * pushSettings), and both times the only symptom was the generic warning
 * below, which sends you looking at the network.
 *
 * PostgREST answers an unknown column with code PGRST204 and names it in the
 * message. Pull it out and say which migration is missing, so the next time
 * this happens it takes a minute instead of an afternoon.
 */
function missingColumn(error: { code?: string; message?: string }): string | null {
  if (error.code !== 'PGRST204') return null;
  const named = /'([a-z0-9_]+)' column/i.exec(error.message ?? '');
  return named ? named[1] : 'an unknown column';
}

export function reportSyncError(
  context: string,
  message?: string,
  error?: { code?: string; message?: string }
): void {
  console.warn(`[sync] ${context} failed:`, message ?? '');
  const column = error ? missingColumn(error) : null;
  if (column) {
    // Loud and specific, and not swallowed by the once-per-session flag: this
    // one is a deployment mistake that will not fix itself, and it breaks
    // every sync until someone runs the migration.
    console.error(
      `[sync] the database has no "${column}" column. A migration in ` +
        'supabase/migrations/ has not been run against this project. Until it ' +
        'is, every write to this table fails and nothing syncs.'
    );
    if (__DEV__) {
      Alert.alert(
        'Database is behind the app',
        `The "${column}" column is missing. Run the pending migration in ` +
          'supabase/migrations/ against this project — until then nothing syncs.',
        [{ text: 'OK' }]
      );
      return;
    }
  }
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
  goalsAutoUpdate: boolean;
  goalsBasisWeightLbs?: number;
  waterGoal: number;
  weeklyWorkoutGoal: number;
  recoveryPresets: Partial<Record<RecoveryKind, RecoveryPreset>>;
  waterIncrement: number;
  showWaterTracker: boolean;
  themeMode: ThemeMode;
  autoRestTimer: boolean;
  defaultRestSeconds: number;
  bodyWeightLbs?: number;
  profile?: UserProfile;
  recentFoods: Food[];
  favoriteFoods: Food[];
  customFoods: Food[];
  customExercises: string[];
  savedMeals: SavedMeal[];
  waterIntake: Record<string, number>;
  workoutTemplates: WorkoutTemplate[];
}

/**
 * Pick the cloud-synced settings out of the store.
 *
 * One builder, because there were two — the store's and hydrate's — and when
 * the adaptive-goal fields were added, only the store's was updated. Every
 * push down the hydrate path then wrote goals_basis_weight_lbs: null, and a
 * null basis is exactly what marks goals as hand-set, so signing in on a
 * second device switched adaptive goals off. tsc did flag it; nothing was
 * running tsc. Hence `npm run typecheck`.
 */
export function settingsSnapshot(s: AppState): SettingsSnapshot {
  return {
    goals: s.goals,
    goalsAutoUpdate: s.goalsAutoUpdate,
    goalsBasisWeightLbs: s.goalsBasisWeightLbs,
    waterGoal: s.waterGoal,
    weeklyWorkoutGoal: s.weeklyWorkoutGoal,
    recoveryPresets: s.recoveryPresets,
    waterIncrement: s.waterIncrement,
    showWaterTracker: s.showWaterTracker,
    themeMode: s.themeMode,
    autoRestTimer: s.autoRestTimer,
    defaultRestSeconds: s.defaultRestSeconds,
    bodyWeightLbs: s.bodyWeightLbs,
    profile: s.profile,
    recentFoods: s.recentFoods,
    favoriteFoods: s.favoriteFoods,
    customFoods: s.customFoods,
    customExercises: s.customExercises,
    savedMeals: s.savedMeals,
    waterIntake: s.waterIntake,
    workoutTemplates: s.workoutTemplates,
  };
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
  if (error) reportSyncError('pushEntry', error.message, error);
}

export async function pushEntries(entries: FoodEntry[]): Promise<void> {
  if (!enabled() || entries.length === 0) return;
  const { error } = await supabase
    .from('food_entries')
    .upsert(entries.map(entryRow));
  if (error) reportSyncError('pushEntries', error.message, error);
}

export async function deleteEntryRemote(entryId: string): Promise<void> {
  if (!enabled()) return;
  const { error } = await supabase
    .from('food_entries')
    .delete()
    .eq('id', entryId)
    .eq('user_id', userId as string);
  if (error) reportSyncError('deleteEntry', error.message, error);
}

/** Column name in user_settings for each snapshot field. */
const SETTINGS_COLUMN: Record<keyof SettingsSnapshot, string> = {
  goals: 'goals',
  goalsAutoUpdate: 'goals_auto_update',
  goalsBasisWeightLbs: 'goals_basis_weight_lbs',
  waterGoal: 'water_goal',
  weeklyWorkoutGoal: 'weekly_workout_goal',
  recoveryPresets: 'recovery_presets',
  waterIncrement: 'water_increment',
  showWaterTracker: 'show_water_tracker',
  themeMode: 'theme_mode',
  autoRestTimer: 'auto_rest_timer',
  defaultRestSeconds: 'default_rest_seconds',
  bodyWeightLbs: 'body_weight_lbs',
  profile: 'profile',
  recentFoods: 'recent_foods',
  favoriteFoods: 'favorite_foods',
  customFoods: 'custom_foods',
  customExercises: 'custom_exercises',
  savedMeals: 'saved_meals',
  waterIntake: 'water_intake',
  workoutTemplates: 'workout_templates',
};

export type SettingsField = keyof SettingsSnapshot;

/**
 * Write the settings row, or just the fields that changed.
 *
 * `fields` exists because this used to send all twenty columns every time,
 * and about twenty different actions call it. Nudging the water goal uploaded
 * the saved meals, the custom foods, every workout template and the whole
 * water map along with it — a few hundred kilobytes for a one-number change,
 * on a phone connection.
 *
 * Omitting `fields` still sends everything, which is what hydrate wants: it
 * writes the merged snapshot back so a partial or older cloud row heals.
 */
export async function pushSettings(
  s: SettingsSnapshot,
  fields?: readonly SettingsField[]
): Promise<void> {
  if (!enabled()) return;
  const full = {
    user_id: userId,
    goals: s.goals,
    goals_auto_update: s.goalsAutoUpdate,
    goals_basis_weight_lbs: s.goalsBasisWeightLbs ?? null,
    water_goal: s.waterGoal,
    // Needs migration 0004. Until that column exists this one field fails the
    // whole upsert, taking goals, templates and water with it — see the note
    // at the top of 0004_weekly_workout_goal.sql.
    weekly_workout_goal: s.weeklyWorkoutGoal,
    // Needs migration 0005, same hazard as the line above.
    recovery_presets: s.recoveryPresets,
    water_increment: s.waterIncrement,
    show_water_tracker: s.showWaterTracker,
    theme_mode: s.themeMode,
    auto_rest_timer: s.autoRestTimer,
    default_rest_seconds: s.defaultRestSeconds,
    body_weight_lbs: s.bodyWeightLbs ?? null,
    profile: s.profile ?? null,
    recent_foods: s.recentFoods,
    favorite_foods: s.favoriteFoods,
    custom_foods: s.customFoods,
    // Needs migration 0003. Until that column exists this one field fails the
    // whole upsert, taking goals, templates and water with it — see the note
    // at the top of 0003_custom_exercises.sql.
    custom_exercises: s.customExercises,
    saved_meals: s.savedMeals,
    water_intake: s.waterIntake,
    workout_templates: s.workoutTemplates,
    updated_at: new Date().toISOString(),
  };
  // user_id and updated_at always travel: the first identifies the row for
  // the upsert, the second is what makes it an update rather than a no-op.
  const row = fields
    ? fields.reduce(
        (acc, f) => {
          acc[SETTINGS_COLUMN[f]] = (full as Record<string, unknown>)[SETTINGS_COLUMN[f]];
          return acc;
        },
        { user_id: full.user_id, updated_at: full.updated_at } as Record<string, unknown>
      )
    : full;
  const { error } = await supabase.from('user_settings').upsert(row);
  if (error) reportSyncError('pushSettings', error.message, error);
}

// ── Body weight ─────────────────────────────────────────────────────────────
// One row per weigh-in, keyed on the millisecond it was logged, so a single
// entry can be added or removed without re-sending the whole history. It used
// to be one jsonb column inside user_settings, which meant every settings
// change carried years of weigh-ins with it.
function weightRow(e: BodyWeightEntry) {
  return {
    user_id: userId,
    logged_at: e.loggedAt,
    date: e.date,
    lbs: e.lbs,
    updated_at: new Date().toISOString(),
  };
}

export async function pushBodyWeight(e: BodyWeightEntry): Promise<void> {
  if (!enabled()) return;
  const { error } = await supabase.from('body_weight').upsert(weightRow(e));
  if (error) reportSyncError('pushBodyWeight', error.message, error);
}

export async function pushBodyWeights(list: BodyWeightEntry[]): Promise<void> {
  if (!enabled() || list.length === 0) return;
  const { error } = await supabase.from('body_weight').upsert(list.map(weightRow));
  if (error) reportSyncError('pushBodyWeights', error.message, error);
}

export async function deleteBodyWeightRemote(loggedAt: number): Promise<void> {
  if (!enabled()) return;
  const { error } = await supabase
    .from('body_weight')
    .delete()
    .eq('logged_at', loggedAt)
    .eq('user_id', userId as string);
  if (error) reportSyncError('deleteBodyWeight', error.message, error);
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
    // Needs migration 0005. Until that column exists this field fails the
    // upsert and no finished workout syncs at all — see the note at the top
    // of 0005_recovery_sessions.sql.
    activity_type: w.activityType ?? null,
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
  if (error) reportSyncError('pushWorkout', error.message, error);
}

export async function pushWorkouts(list: WorkoutSession[]): Promise<void> {
  if (!enabled() || list.length === 0) return;
  const { error } = await supabase.from('workouts').upsert(list.map(workoutRow));
  if (error) reportSyncError('pushWorkouts', error.message, error);
}

export async function deleteWorkoutRemote(id: string): Promise<void> {
  if (!enabled()) return;
  const { error } = await supabase
    .from('workouts')
    .delete()
    .eq('id', id)
    .eq('user_id', userId as string);
  if (error) reportSyncError('deleteWorkout', error.message, error);
}
