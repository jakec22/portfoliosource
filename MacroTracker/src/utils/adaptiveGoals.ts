import {
  ACTIVITY_LEVELS,
  buildPlan,
  computeTdee,
  imperialToKg,
  type GoalPlan,
} from './tdee';
import type { BodyWeightEntry, DailyGoals, UserProfile } from '../types';

/** Readings averaged to smooth out day-to-day water/food swings. */
export const SMOOTHING_DAYS = 7;

/**
 * How far the smoothed weight must drift from the weight the current goals
 * were built on before they're rebuilt.
 *
 * Mifflin-St Jeor moves TDEE by only about 7 kcal per pound at typical
 * activity multipliers, so a 2 lb trigger would announce a ~14 kcal change
 * every couple of weeks — noise presented as news. At 5 lb the shift is ~35
 * kcal and lands roughly every five weeks for someone losing a pound a week,
 * which is both a real change and a reasonable cadence to be told about.
 */
export const REBASE_THRESHOLD_LBS = 5;

export interface GoalsUpdate {
  plan: GoalPlan;
  previousGoals: DailyGoals;
  /** Weight the old goals were built on. */
  fromWeightLbs: number;
  /** Smoothed weight the new goals are built on. */
  toWeightLbs: number;
}

/**
 * Average of the readings in the trailing window.
 *
 * No minimum count: someone who weighs weekly has one reading in the window
 * and that reading is the best estimate available — requiring several would
 * mean their goals never track at all. Daily weighers get real smoothing;
 * everyone else effectively gets their latest reading, which is what they'd
 * expect. Falls back to the most recent entry when the window is empty.
 */
export function smoothedWeight(
  log: BodyWeightEntry[],
  days = SMOOTHING_DAYS,
  now = Date.now()
): number | null {
  if (log.length === 0) return null;
  const cutoff = now - days * 86400000;
  const recent = log.filter((e) => e.loggedAt >= cutoff);
  const sample = recent.length > 0 ? recent : [log[0]];
  const sum = sample.reduce((n, e) => n + e.lbs, 0);
  return Math.round((sum / sample.length) * 10) / 10;
}

/**
 * Rebuild the goal plan for a profile at a given body weight. Returns null if
 * the profile can't produce a valid TDEE (computeTdee rejects out-of-range
 * age/weight/height), so a nonsense profile can't rewrite someone's targets.
 */
export function planForWeight(profile: UserProfile, weightLbs: number): GoalPlan | null {
  const weightKg = imperialToKg(weightLbs);
  const activity = ACTIVITY_LEVELS[profile.activityIdx];
  if (!activity) return null;
  // Argument order is (sex, age, weightKg, heightCm, multiplier) — and the
  // last argument is the multiplier itself, not the index into ACTIVITY_LEVELS.
  const tdee = computeTdee(
    profile.sex,
    profile.age,
    weightKg,
    profile.heightCm,
    activity.multiplier
  );
  if (tdee == null) return null;
  return buildPlan(tdee, weightKg, profile.goalType, profile.rateLbPerWeek);
}

/**
 * Decide whether goals should be rebuilt after a new weigh-in, and what to.
 * Returns null when nothing should change — no profile to compute from, auto
 * update switched off, not enough readings, or the drift is within tolerance.
 */
export function evaluateGoalsUpdate(args: {
  profile?: UserProfile;
  goals: DailyGoals;
  bodyWeightLog: BodyWeightEntry[];
  goalsAutoUpdate: boolean;
  /** Weight the current goals were built on; undefined for hand-set goals. */
  goalsBasisWeightLbs?: number;
  now?: number;
}): GoalsUpdate | null {
  const { profile, goals, bodyWeightLog, goalsAutoUpdate, goalsBasisWeightLbs } = args;

  // No wizard run yet, or the user took manual control of their numbers.
  if (!profile || !goalsAutoUpdate || goalsBasisWeightLbs == null) return null;

  const smoothed = smoothedWeight(bodyWeightLog, SMOOTHING_DAYS, args.now ?? Date.now());
  if (smoothed == null) return null;
  if (Math.abs(smoothed - goalsBasisWeightLbs) < REBASE_THRESHOLD_LBS) return null;

  const plan = planForWeight(profile, smoothed);
  if (!plan) return null;
  // The calorie floor can clamp two different weights to the same targets;
  // don't announce an update that changes nothing.
  if (plan.goals.calories === goals.calories && plan.goals.protein === goals.protein) {
    return null;
  }

  return {
    plan,
    previousGoals: goals,
    fromWeightLbs: goalsBasisWeightLbs,
    toWeightLbs: smoothed,
  };
}
