import type { BodyWeightEntry, DailyGoals, FoodEntry, WorkoutSession } from '../types';
import { formatDate, parseDate, todayString } from './date';

/**
 * Pure aggregations for the analytics dashboard: body-weight trend, calorie /
 * macro adherence, and weekly workout volume. Kept free of store/UI imports so
 * they're easy to reason about and test.
 */

// ── Body weight ──────────────────────────────────────────────────────────────

export interface WeightPoint {
  date: string; // YYYY-MM-DD
  lbs: number;
}

// One point per reading, oldest → newest, limited to roughly the last `days`
// calendar days. Multiple readings on the same day each get their own point so
// every logged weight shows up on the trend.
export function weightTrend(log: BodyWeightEntry[], days: number): WeightPoint[] {
  if (log.length === 0) return [];
  const cutoff = formatDate(new Date(Date.now() - (days - 1) * 86400000));
  return log
    .filter((e) => e.date >= cutoff)
    .slice()
    .sort((a, b) =>
      a.date === b.date ? a.loggedAt - b.loggedAt : a.date < b.date ? -1 : 1
    )
    .map((e) => ({ date: e.date, lbs: e.lbs }));
}

// ── Nutrition adherence ──────────────────────────────────────────────────────

export interface DayNutrition {
  date: string;
  calories: number;
  protein: number;
  logged: boolean; // whether any food was logged that day
}

export interface NutritionSummary {
  days: DayNutrition[]; // oldest → newest, exactly `days` entries
  avgCalories: number; // averaged over logged days only
  avgProtein: number;
  loggedDays: number;
  daysOnTarget: number; // logged days within ±10% of the calorie goal
}

function dayTotals(entries: FoodEntry[]): { calories: number; protein: number } {
  let calories = 0;
  let protein = 0;
  for (const e of entries) {
    calories += e.food.macros.calories * e.servings;
    protein += e.food.macros.protein * e.servings;
  }
  return { calories, protein };
}

export function nutritionAdherence(
  logs: Record<string, FoodEntry[]>,
  goals: DailyGoals,
  days: number
): NutritionSummary {
  const out: DayNutrition[] = [];
  let calSum = 0;
  let proSum = 0;
  let loggedDays = 0;
  let daysOnTarget = 0;
  const tol = goals.calories * 0.1;

  for (let i = days - 1; i >= 0; i--) {
    const date = formatDate(new Date(Date.now() - i * 86400000));
    const entries = logs[date] ?? [];
    const logged = entries.length > 0;
    const { calories, protein } = dayTotals(entries);
    if (logged) {
      loggedDays += 1;
      calSum += calories;
      proSum += protein;
      if (Math.abs(calories - goals.calories) <= tol) daysOnTarget += 1;
    }
    out.push({ date, calories: Math.round(calories), protein: Math.round(protein), logged });
  }

  return {
    days: out,
    avgCalories: loggedDays ? Math.round(calSum / loggedDays) : 0,
    avgProtein: loggedDays ? Math.round(proSum / loggedDays) : 0,
    loggedDays,
    daysOnTarget,
  };
}

// ── Workout volume ───────────────────────────────────────────────────────────

export interface WeekVolume {
  startDate: string; // first day of the rolling 7-day bucket
  volume: number; // Σ weight × reps over completed sets
  workouts: number;
}

// Volume of a single session = Σ weight × reps over completed sets (matches the
// workout-summary total). Falls back to counting all sets when none are ticked.
function sessionVolume(s: WorkoutSession): number {
  let vol = 0;
  let anyCompleted = false;
  for (const ex of s.exercises) {
    for (const set of ex.sets) {
      if (set.completed) {
        anyCompleted = true;
        vol += set.weight * set.reps;
      }
    }
  }
  if (anyCompleted) return vol;
  // No sets checked off — count everything logged so the session still shows.
  let all = 0;
  for (const ex of s.exercises) for (const set of ex.sets) all += set.weight * set.reps;
  return all;
}

// Rolling 7-day buckets ending today, oldest → newest. Bucket k back from the
// end covers [today-(7k+6) .. today-7k].
export function weeklyVolume(history: WorkoutSession[], weeks: number): WeekVolume[] {
  const today = parseDate(todayString()).getTime();
  const buckets: WeekVolume[] = [];
  for (let k = weeks - 1; k >= 0; k--) {
    const startMs = today - (7 * k + 6) * 86400000;
    buckets.push({ startDate: formatDate(new Date(startMs)), volume: 0, workouts: 0 });
  }
  for (const s of history) {
    if (s.completedAt == null) continue;
    const dayMs = parseDate(s.date).getTime();
    const daysAgo = Math.floor((today - dayMs) / 86400000);
    if (daysAgo < 0) continue;
    const k = Math.floor(daysAgo / 7); // 0 = most recent week
    if (k >= weeks) continue;
    const idx = weeks - 1 - k; // into the oldest→newest array
    buckets[idx].volume += sessionVolume(s);
    buckets[idx].workouts += 1;
  }
  return buckets;
}
