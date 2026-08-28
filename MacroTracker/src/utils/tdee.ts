import { DailyGoals } from '../types';

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

// Never recommend an unsafely low intake even for aggressive cuts.
const CALORIE_FLOOR = 1200;

export interface GoalMeta {
  type: GoalType;
  label: string;
  emoji: string;
  blurb: string;
}

// Accent color per goal is intentionally not here — it's a Theme color
// (chosen in GoalWizardScreen via useTheme()), not a fixed hex, so it
// follows whichever pack is active instead of hardcoding one palette.
export const GOAL_META: Record<GoalType, GoalMeta> = {
  lose: { type: 'lose', label: 'Lose Weight', emoji: '📉', blurb: 'Eat below maintenance to drop fat' },
  maintain: { type: 'maintain', label: 'Maintain', emoji: '⚖️', blurb: 'Hold your current weight' },
  gain: { type: 'gain', label: 'Gain Muscle', emoji: '📈', blurb: 'Eat above maintenance for a lean bulk' },
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
  const split = SPLIT[goalType];
  const fiber = Math.round(weightKg * 0.4); // ~0.4 g/kg, ~14g per 1000 kcal
  return {
    goalType,
    rateLbPerWeek,
    tdee,
    calorieDelta: calories - tdee, // reflects the floor clamp
    goals: {
      calories,
      protein: Math.round((calories * split.protein) / 4),
      carbs: Math.round((calories * split.carbs) / 4),
      fat: Math.round((calories * split.fat) / 9),
      fiber,
    },
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
