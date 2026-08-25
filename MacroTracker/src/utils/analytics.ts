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

// ── Weekly insights ──────────────────────────────────────────────────────────
// A plain-English synthesis of the last 7 days, combining nutrition, workouts,
// streaks, and weight into a few headline stats plus prioritized coaching
// callouts. Pure — fed entirely from store data the Trends screen already has.

export interface InsightHighlight {
  tone: 'positive' | 'suggest';
  icon: string;
  text: string;
}

export interface WeeklyInsights {
  hasData: boolean; // anything logged or trained this week
  loggedDays: number; // days (0-7) with any food logged
  avgCalories: number; // averaged over logged days
  avgProtein: number;
  caloriePctOfGoal: number; // avg calories as a % of goal (rounded)
  daysOnTarget: number; // logged days within ±10% of the calorie goal
  bestDay: { date: string; calories: number; protein: number } | null;
  workouts: number; // completed sessions this week
  workoutVolume: number; // Σ weight × reps over those sessions
  streak: number; // consecutive logged days ending today/yesterday
  weightChange: number | null; // lbs change across the week, if ≥2 readings
  highlights: InsightHighlight[];
}

// Consecutive days with food logged, counting back from today. Today being
// empty doesn't break the streak (the day isn't over) — we start from yesterday
// in that case so an unfinished today never reads as a miss.
function loggingStreak(logs: Record<string, FoodEntry[]>): number {
  const todayLogged = (logs[todayString()] ?? []).length > 0;
  let streak = 0;
  for (let d = todayLogged ? 0 : 1; ; d++) {
    const date = formatDate(new Date(Date.now() - d * 86400000));
    if ((logs[date] ?? []).length > 0) streak += 1;
    else break;
  }
  return streak;
}

export function weeklyInsights(
  logs: Record<string, FoodEntry[]>,
  goals: DailyGoals,
  history: WorkoutSession[],
  weightLog: BodyWeightEntry[]
): WeeklyInsights {
  const DAYS = 7;
  const tol = goals.calories * 0.1;

  let calSum = 0;
  let proSum = 0;
  let loggedDays = 0;
  let daysOnTarget = 0;
  let bestDay: WeeklyInsights['bestDay'] = null;
  let bestScore = Infinity;

  for (let i = DAYS - 1; i >= 0; i--) {
    const date = formatDate(new Date(Date.now() - i * 86400000));
    const entries = logs[date] ?? [];
    if (entries.length === 0) continue;
    loggedDays += 1;
    const { calories, protein } = dayTotals(entries);
    calSum += calories;
    proSum += protein;
    if (Math.abs(calories - goals.calories) <= tol) daysOnTarget += 1;

    // "Best" = closest to the calorie goal while not falling short on protein.
    const calDev = goals.calories > 0 ? Math.abs(calories - goals.calories) / goals.calories : 0;
    const proShort = goals.protein > 0 ? Math.max(0, goals.protein - protein) / goals.protein : 0;
    const score = calDev + proShort;
    if (score < bestScore) {
      bestScore = score;
      bestDay = { date, calories: Math.round(calories), protein: Math.round(protein) };
    }
  }

  const avgCalories = loggedDays ? Math.round(calSum / loggedDays) : 0;
  const avgProtein = loggedDays ? Math.round(proSum / loggedDays) : 0;
  const caloriePctOfGoal =
    loggedDays && goals.calories > 0 ? Math.round((avgCalories / goals.calories) * 100) : 0;

  // Workouts completed within the last 7 calendar days.
  const cutoff = formatDate(new Date(Date.now() - (DAYS - 1) * 86400000));
  let workouts = 0;
  let workoutVolume = 0;
  for (const s of history) {
    if (s.completedAt == null) continue;
    if (s.date < cutoff) continue;
    workouts += 1;
    workoutVolume += sessionVolume(s);
  }

  // Weight change across readings inside the window.
  const weekWeights = weightTrend(weightLog, DAYS);
  const weightChange =
    weekWeights.length >= 2
      ? Math.round((weekWeights[weekWeights.length - 1].lbs - weekWeights[0].lbs) * 10) / 10
      : null;

  const streak = loggingStreak(logs);
  const hasData = loggedDays > 0 || workouts > 0;

  // ── Coaching callouts, prioritized: lead with a win, then the most useful
  // nudge. Capped at three so the card stays scannable.
  const wins: InsightHighlight[] = [];
  const nudges: InsightHighlight[] = [];

  if (streak >= 3) {
    wins.push({ tone: 'positive', icon: '🔥', text: `${streak}-day logging streak — keep it going.` });
  }
  if (workouts >= 3) {
    wins.push({ tone: 'positive', icon: '💪', text: `${workouts} workouts this week — strong consistency.` });
  }
  if (loggedDays >= 2 && daysOnTarget >= Math.ceil(loggedDays * 0.6)) {
    wins.push({
      tone: 'positive',
      icon: '🎯',
      text: `On your calorie goal ${daysOnTarget} of ${loggedDays} logged days.`,
    });
  }

  if (loggedDays >= 2 && avgProtein < goals.protein * 0.9) {
    const short = Math.round(goals.protein - avgProtein);
    nudges.push({
      tone: 'suggest',
      icon: '🥚',
      text: `Protein ran ~${short}g/day under your ${goals.protein}g goal — a scoop of whey or Greek yogurt closes it.`,
    });
  }
  if (loggedDays >= 3 && caloriePctOfGoal > 110) {
    const over = Math.round(avgCalories - goals.calories);
    nudges.push({
      tone: 'suggest',
      icon: '📈',
      text: `Averaging ${avgCalories} kcal/day — about ${over} over your goal.`,
    });
  } else if (loggedDays >= 3 && caloriePctOfGoal > 0 && caloriePctOfGoal < 85) {
    const under = Math.round(goals.calories - avgCalories);
    nudges.push({
      tone: 'suggest',
      icon: '📉',
      text: `Averaging ${avgCalories} kcal/day — about ${under} under your goal. Make sure you're fueling enough.`,
    });
  }
  if (workouts === 0) {
    nudges.push({ tone: 'suggest', icon: '🏋️', text: 'No workouts logged this week — even one session counts.' });
  }
  if (loggedDays > 0 && loggedDays < 4) {
    nudges.push({
      tone: 'suggest',
      icon: '📝',
      text: `Only ${loggedDays} ${loggedDays === 1 ? 'day' : 'days'} logged — consistency is what makes the trends meaningful.`,
    });
  }

  const highlights = [...wins, ...nudges].slice(0, 3);

  return {
    hasData,
    loggedDays,
    avgCalories,
    avgProtein,
    caloriePctOfGoal,
    daysOnTarget,
    bestDay,
    workouts,
    workoutVolume,
    streak,
    weightChange,
    highlights,
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
export function sessionVolume(s: WorkoutSession): number {
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

// ── Workout insights (headline stats for the Workout Insights page) ─────────

export interface WorkoutInsightsSummary {
  totalWorkouts: number;
  totalVolume: number; // lifetime Σ weight × reps
  avgDurationMs: number; // across sessions with a recorded duration
  currentStreakWeeks: number; // consecutive trailing weeks (incl. this one) with a workout
  daysSinceLast: number | null; // null when there's no completed workout yet
}

// Headline stats for the Workout Insights page: consistency (streak), volume,
// duration, and recency — everything derivable straight from session history,
// no new data model required.
export function workoutInsights(history: WorkoutSession[]): WorkoutInsightsSummary {
  const completed = history.filter((s) => s.completedAt != null);

  let totalVolume = 0;
  let durationSum = 0;
  let durationCount = 0;
  let lastCompletedAt = 0;
  for (const s of completed) {
    totalVolume += sessionVolume(s);
    const duration = s.completedAt! - s.startedAt;
    if (duration > 0) {
      durationSum += duration;
      durationCount += 1;
    }
    if (s.completedAt! > lastCompletedAt) lastCompletedAt = s.completedAt!;
  }

  // Streak: walk trailing weekly buckets backward from the current week,
  // stopping at the first week with no workout.
  const weeks = weeklyVolume(history, 52);
  let currentStreakWeeks = 0;
  for (let i = weeks.length - 1; i >= 0; i--) {
    if (weeks[i].workouts === 0) break;
    currentStreakWeeks += 1;
  }

  return {
    totalWorkouts: completed.length,
    totalVolume,
    avgDurationMs: durationCount ? Math.round(durationSum / durationCount) : 0,
    currentStreakWeeks,
    daysSinceLast: lastCompletedAt
      ? Math.floor((Date.now() - lastCompletedAt) / 86400000)
      : null,
  };
}
