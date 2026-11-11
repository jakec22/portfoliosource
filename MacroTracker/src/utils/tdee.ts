import { DailyGoals } from '../types';
import type { IconName } from '../components/Icon';

// Shared TDEE + macro-target math used by both the guided Goal Wizard and the
// inline calculator on the Goals screen. Keeping it in one place means the two
// entry points can never drift apart in their numbers.

export type Sex = 'male' | 'female';
export type Units = 'imperial' | 'metric';
export type GoalType = 'lose' | 'maintain' | 'gain';

export interface ActivityLevel {
  label: string;
  description: string;
  multiplier: number;
}

export const ACTIVITY_LEVELS: ActivityLevel[] = [
  { label: 'Not Active', description: 'Desk job, little exercise', multiplier: 1.2 },
  { label: 'Light', description: '1–3 workouts/week', multiplier: 1.375 },
  { label: 'Moderate', description: '3–5 workouts/week', multiplier: 1.55 },
  { label: 'Active', description: '6–7 workouts/week', multiplier: 1.725 },
  { label: 'Very Active', description: 'Physical job + daily exercise', multiplier: 1.9 },
];

// Macro split (fraction of calories) per goal. Higher protein on a cut to
// preserve muscle; more carbs on a gain to fuel training.
const SPLIT: Record<GoalType, { protein: number; carbs: number; fat: number }> = {
  lose: { protein: 0.4, carbs: 0.3, fat: 0.3 },
  maintain: { protein: 0.3, carbs: 0.4, fat: 0.3 },
  gain: { protein: 0.3, carbs: 0.45, fat: 0.25 },
};

// ~3500 kcal per pound of body weight, spread across a week → kcal/day per
// lb/week of intended change.
const KCAL_PER_LB_WEEK = 500;

/** Calories per gram. The reason macro targets can never be arbitrary. */
export const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const;

/** What a set of macro targets actually comes to. */
export function macroCalories(g: { protein: number; carbs: number; fat: number }): number {
  return (
    g.protein * KCAL_PER_GRAM.protein +
    g.carbs * KCAL_PER_GRAM.carbs +
    g.fat * KCAL_PER_GRAM.fat
  );
}

/**
 * Grams for a calorie target and a protein/carb/fat split, each as a
 * fraction of 1.
 *
 * These will not add back up to `calories`, and cannot be made to. Grams are
 * whole numbers, so protein and carbs move in 4-kcal steps and fat in 9-kcal
 * ones; a target of 1,210 split 30/40/30 lands on 1,208 and the nearest
 * exact answer is four grams of carbs away in one direction and two grams of
 * fat in the other — six grams of movement to correct two calories, and a
 * split that no longer reads as the one that was asked for.
 *
 * So the grams are the honest number and the calorie goal is the one that
 * gives: every caller pairs this with macroCalories() and stores that as the
 * target. The goal moves by at most a handful of calories, which is well
 * inside the error of any food label it will ever be compared against,
 * and in exchange the two figures agree exactly and always.
 */
export interface MacroGrams {
  protein: number;
  carbs: number;
  fat: number;
}

export type MacroKey = keyof MacroGrams;

/**
 * Set one macro and take the difference out of the other two.
 *
 * The calorie budget is fixed and the three macros spend it, so raising
 * protein has to lower something. The other two absorb it in proportion to
 * the share they already hold, which keeps the shape of a split while
 * changing one part of it — drag protein up on a low-carb plan and carbs do
 * not suddenly become the thing that gives way.
 *
 * Whole grams again, so the three rarely land back on the budget exactly.
 * Fat is rounded first and carbs take the remainder, because carbs move in
 * 4-kcal steps and fat in 9: closing on the finer of the two leaves the
 * smaller error.
 *
 * Both others at zero is the one case with no ratio to preserve — a plan
 * that is all protein — so the remainder is split evenly rather than
 * dividing by zero.
 */
export function rebalanceMacros(
  budgetKcal: number,
  current: MacroGrams,
  macro: MacroKey,
  grams: number
): MacroGrams {
  const next: MacroGrams = { ...current, [macro]: Math.max(0, Math.round(grams)) };
  const others = (['protein', 'carbs', 'fat'] as MacroKey[]).filter((k) => k !== macro);

  const remaining = budgetKcal - next[macro] * KCAL_PER_GRAM[macro];
  if (remaining <= 0) {
    for (const k of others) next[k] = 0;
    return next;
  }

  const priorCals = others.map((k) => current[k] * KCAL_PER_GRAM[k]);
  const priorSum = priorCals[0] + priorCals[1];
  const shares =
    priorSum > 0 ? priorCals.map((v) => v / priorSum) : [0.5, 0.5];

  // Fat first at its coarse 9-kcal step, then carbs mop up at 4. Done the
  // other way round the leftover would have to land on fat and could be off
  // by as much as 8.
  const fatIndex = others.indexOf('fat');
  if (fatIndex >= 0) {
    const carbIndex = 1 - fatIndex;
    const fat = Math.max(0, Math.round((remaining * shares[fatIndex]) / KCAL_PER_GRAM.fat));
    const left = remaining - fat * KCAL_PER_GRAM.fat;
    next.fat = fat;
    next[others[carbIndex]] = Math.max(
      0,
      Math.round(left / KCAL_PER_GRAM[others[carbIndex]])
    );
  } else {
    // Dragging fat itself: protein and carbs are both 4 kcal a gram, so
    // neither is the coarse one and the order does not matter.
    next[others[0]] = Math.max(
      0,
      Math.round((remaining * shares[0]) / KCAL_PER_GRAM[others[0]])
    );
    const left = remaining - next[others[0]] * KCAL_PER_GRAM[others[0]];
    next[others[1]] = Math.max(0, Math.round(left / KCAL_PER_GRAM[others[1]]));
  }

  return next;
}

export function gramsForSplit(
  calories: number,
  split: { protein: number; carbs: number; fat: number }
): { protein: number; carbs: number; fat: number } {
  return {
    protein: Math.max(0, Math.round((calories * split.protein) / KCAL_PER_GRAM.protein)),
    carbs: Math.max(0, Math.round((calories * split.carbs) / KCAL_PER_GRAM.carbs)),
    fat: Math.max(0, Math.round((calories * split.fat) / KCAL_PER_GRAM.fat)),
  };
}

// Never recommend an unsafely low intake even for aggressive cuts.
const CALORIE_FLOOR = 1200;

export interface GoalMeta {
  type: GoalType;
  label: string;
  // A concept from the icon set, not a glyph — these were emoji, which the
  // theme packs could not tint.
  icon: IconName;
  blurb: string;
}

// Accent color per goal is intentionally not here — it's a Theme color
// (chosen in GoalWizardScreen via useTheme()), not a fixed hex, so it
// follows whichever pack is active instead of hardcoding one palette.
export const GOAL_META: Record<GoalType, GoalMeta> = {
  lose: { type: 'lose', label: 'Lose Weight', icon: 'trendDown', blurb: 'Eat below maintenance to drop fat' },
  maintain: { type: 'maintain', label: 'Maintain', icon: 'balance', blurb: 'Hold your current weight' },
  gain: { type: 'gain', label: 'Gain Muscle', icon: 'trends', blurb: 'Eat above maintenance for a lean bulk' },
};

// Pace options (lb/week) offered per goal. Maintain has none.
export const RATE_OPTIONS: Record<GoalType, number[]> = {
  lose: [0.5, 1, 1.5],
  maintain: [0],
  gain: [0.25, 0.5],
};

export function imperialToKg(lbs: number): number {
  return lbs / 2.2046;
}

export function imperialHeightToCm(feet: number, inches: number): number {
  return (feet * 12 + inches) * 2.54;
}

export function bmrMifflin(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  return sex === 'male'
    ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
    : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
}

// Returns the maintenance TDEE, or null when any input is out of a sane range.
export function computeTdee(
  sex: Sex,
  age: number,
  weightKg: number,
  heightCm: number,
  activityMultiplier: number,
): number | null {
  if (!age || isNaN(age) || age < 10 || age > 100) return null;
  if (!weightKg || weightKg < 30 || weightKg > 300) return null;
  if (!heightCm || heightCm < 100 || heightCm > 250) return null;
  const bmr = bmrMifflin(sex, weightKg, heightCm, age);
  return Math.round(bmr * activityMultiplier);
}

export interface GoalPlan {
  goalType: GoalType;
  rateLbPerWeek: number; // 0 for maintain
  tdee: number;
  calorieDelta: number; // signed kcal/day vs. maintenance
  goals: DailyGoals;
}

// Turn a maintenance TDEE + chosen goal/pace into concrete daily targets.
export function buildPlan(
  tdee: number,
  weightKg: number,
  goalType: GoalType,
  rateLbPerWeek: number,
): GoalPlan {
  const direction = goalType === 'lose' ? -1 : goalType === 'gain' ? 1 : 0;
  const delta = direction * Math.round((rateLbPerWeek || 0) * KCAL_PER_LB_WEEK);
  const calories = Math.max(CALORIE_FLOOR, Math.round(tdee + delta));
  const fiber = Math.round(weightKg * 0.4); // ~0.4 g/kg, ~14g per 1000 kcal

  // Grams first, then the calorie goal from them — not the other way round.
  // Rounding three macros to whole grams almost never lands back on the
  // number they were derived from, and the plan then ships a calorie target
  // its own macros contradict. See gramsForSplit for why the grams win.
  const macros = gramsForSplit(calories, SPLIT[goalType]);
  const exact = macroCalories(macros);

  return {
    goalType,
    rateLbPerWeek,
    tdee,
    // From the figure actually stored, so the stated deficit is the one the
    // targets describe. Already reflected the CALORIE_FLOOR clamp; this is
    // the same kind of adjustment, a few calories rather than hundreds.
    calorieDelta: exact - tdee,
    goals: { calories: exact, ...macros, fiber },
  };
}

// "−500 kcal/day · ~1 lb/week" style summary for a plan.
export function describePlan(plan: GoalPlan): string {
  if (plan.goalType === 'maintain') return 'At maintenance — hold current weight';
  const sign = plan.calorieDelta < 0 ? '−' : '+';
  const lb = plan.rateLbPerWeek;
  const lbLabel = lb === 1 ? '1 lb' : `${lb} lb`;
  const verb = plan.goalType === 'lose' ? 'loss' : 'gain';
  return `${sign}${Math.abs(plan.calorieDelta)} kcal/day · ~${lbLabel}/week ${verb}`;
}
