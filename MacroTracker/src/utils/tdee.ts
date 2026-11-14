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

/**
 * How the calories left after protein divide between carbs and fat, per goal.
 *
 * Protein is not in here, and that is the point. It used to be — 40% of
 * calories on a cut, 30% otherwise — and a share of calories is the wrong
 * unit for it. Carbs and fat are fuel, so a share of the fuel budget is
 * exactly what they are; protein is structural, its requirement tracks the
 * body it has to maintain, and a percentage makes it track appetite instead.
 * See proteinTargetGPerLb.
 *
 * These are the previous split's carb:fat ratios, normalized and otherwise
 * unchanged: 30/30 → 50/50, 40/30 → 57/43, 45/25 → 64/36. More carbs on a
 * gain to fuel training; an even divide on a cut, where carbs come down but
 * fat has a floor of its own to respect.
 */
const CARB_FAT: Record<GoalType, { carbs: number; fat: number }> = {
  lose: { carbs: 0.5, fat: 0.5 },
  maintain: { carbs: 0.57, fat: 0.43 },
  gain: { carbs: 0.64, fat: 0.36 },
};

// ~3500 kcal per pound of body weight, spread across a week → kcal/day per
// lb/week of intended change.
const KCAL_PER_LB_WEEK = 500;

const LB_PER_KG = 2.2046;

/**
 * The band the protein target lives in, in grams per pound of body weight.
 *
 * 1.2 g/lb (≈2.65 g/kg) is a ceiling rather than a destination: it exists to
 * stop the terms below compounding into a number nobody can eat, and it
 * should bind only for the few people who sit at the top of every one of
 * them. It is set above the ~2.4 g/kg where the evidence for added benefit
 * runs out, deliberately — a cap that sits *at* the top of the useful range
 * ends up being the answer for everyone near it rather than the limit on a
 * few, which is what happened when this was a flat 1.1 and bound in nearly
 * half of all plans. Intakes at this level remain well inside what is safe
 * for healthy adults; they are simply past where more is known to help.
 *
 * The floor (≈1.1 g/kg) sits above the 0.8 g/kg RDA, because somebody
 * tracking macros in a fitness app is not the sedentary reference adult the
 * RDA was set for.
 */
const PROTEIN_CAP_G_PER_LB = 1.2;
const PROTEIN_FLOOR_G_PER_LB = 0.5;

/**
 * Protein, in grams per pound of body weight, for this person and this goal.
 *
 * A cut and a bulk both start at 1.0 g/lb — the round number most lifters
 * already have in their head — and the pace term then puts the cut above it.
 * Moderate is the reference level for activity, so a moderately active
 * person training toward either goal lands on exactly 1.0.
 *
 * This is a product decision taken knowingly against the centre of the
 * evidence, and it is worth writing down which is which. Morton 2018 puts
 * the plateau for lean mass gain at 1.6 g/kg (0.73 g/lb), with the upper
 * confidence bound at 2.2 (1.0); the ISSN range for building muscle is
 * 1.4–2.0 g/kg and for a deficit 2.0–2.4. So 1.0 g/lb is the top of what the
 * data supports rather than its middle: nobody is short-changed by it and
 * nobody is harmed by it, but the marginal gram above ~0.75 is not doing
 * demonstrable work. It is chosen anyway because a target the user does not
 * believe is a target they override, and 1 g/lb is the number this audience
 * trusts.
 *
 * Maintain stays at 0.70 (1.54 g/kg), inside the 1.2–1.6 band for general
 * active intake. Holding muscle is not building it and is not defending it
 * under a deficit, so it is the one goal here with no reason to climb. That
 * does leave a visible step between maintaining and either training goal,
 * which is honest rather than tidy.
 *
 * Then four adjustments, each small enough that no single answer swings the
 * result and none of them can reach the ceiling alone:
 *
 * - **Activity**, referenced to Moderate. Training is the stimulus that makes
 *   protein worth eating, so it is the largest term: ±0.14 g/lb across the
 *   five levels.
 * - **Pace**, on a cut only. A steeper deficit puts more muscle at risk per
 *   week, so 1.5 lb/week asks for more than 0.5 does. A faster bulk gets no
 *   bump — the extra calories are already there.
 * - **Age**, upward from 60. Older muscle responds less to the same dose
 *   (anabolic resistance), so maintaining it costs more protein, which is why
 *   guidance for older adults starts at 1.0–1.2 g/kg rather than 0.8.
 * - **Sex**, a small downward nudge for female. Per pound of *lean* mass the
 *   requirement is the same; per pound of *body* weight it differs only
 *   because average body composition does, and at equal weight women carry a
 *   higher fat fraction. The app does not collect body fat, so this is a
 *   proxy for the number it would rather use. It is deliberately smaller than
 *   the composition gap it stands in for — it is an average standing in for
 *   an individual, and the cost of being wrong should be small.
 */
export function proteinTargetGPerLb(
  goalType: GoalType,
  rateLbPerWeek: number,
  who: { sex: Sex; age: number; activityMultiplier: number },
): number {
  const base = goalType === 'maintain' ? 0.7 : 1.0;

  // Referenced to Moderate (1.55), so this is 0 for the middle answer and
  // runs −0.14 (Not Active) to +0.14 (Very Active).
  const activity = 0.4 * (who.activityMultiplier - 1.55);

  // 0.5 lb/week → 0, 1 → +0.04, 1.5 → +0.08.
  const pace = goalType === 'lose' ? 0.08 * Math.max(0, rateLbPerWeek - 0.5) : 0;

  const age = who.age >= 70 ? 0.1 : who.age >= 60 ? 0.05 : 0;
  const sex = who.sex === 'female' ? -0.05 : 0;

  return clamp(base + activity + pace + age + sex, PROTEIN_FLOOR_G_PER_LB, PROTEIN_CAP_G_PER_LB);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * The share of calories protein may take, as a last line of defense for fat.
 *
 * Only reachable on a plan held up by CALORIE_FLOOR, where a body-weight
 * protein target can be most of a 1,200 kcal budget and leave too little
 * behind for fat to do its hormonal job. It is the old percentage rule kept
 * on as a backstop for the one case it was ever right about, rather than as
 * the thing that sets the number.
 */
const MAX_PROTEIN_SHARE = 0.4;

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
  return lbs / LB_PER_KG;
}

/**
 * The protein ceiling for a given body weight, in whole grams.
 *
 * Floored rather than rounded. "At the absolute most" is the whole point of a
 * cap, and 175 lb × 1.1 rounds to 193 g, which is 1.103 g/lb — a cap that
 * exceeds itself in half of all cases is not one.
 */
export function proteinCapGrams(weightKg: number): number {
  return Math.floor(weightKg * LB_PER_KG * PROTEIN_CAP_G_PER_LB);
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
  who: { sex: Sex; age: number; activityMultiplier: number },
): GoalPlan {
  const direction = goalType === 'lose' ? -1 : goalType === 'gain' ? 1 : 0;
  const delta = direction * Math.round((rateLbPerWeek || 0) * KCAL_PER_LB_WEEK);
  const calories = Math.max(CALORIE_FLOOR, Math.round(tdee + delta));
  const fiber = Math.round(weightKg * 0.4); // ~0.4 g/kg, ~14g per 1000 kcal

  // Protein first, from body weight and this person, and the rest of the
  // budget divides around it. That order is the whole model: protein is the
  // macro with a requirement, so it gets set rather than solved for, and
  // carbs and fat are what is left to allocate.
  //
  // Three limits, in descending likelihood of being the one that bites: the
  // target itself, then the gram-space ceiling, then the share backstop. The
  // gram ceiling is separate from the clamp inside proteinTargetGPerLb
  // because rounding happens after it — 175 lb × 1.1 is 192.5, which rounds
  // to 1.103 g/lb — and proteinCapGrams floors instead.
  const protein = Math.round(
    Math.min(
      weightKg * LB_PER_KG * proteinTargetGPerLb(goalType, rateLbPerWeek, who),
      proteinCapGrams(weightKg),
      (calories * MAX_PROTEIN_SHARE) / KCAL_PER_GRAM.protein,
    ),
  );

  // Carbs and fat take the remainder in the goal's ratio. Fat is rounded
  // first and carbs mop up the difference, for the reason rebalanceMacros
  // gives: carbs move in 4-kcal steps and fat in 9, so closing the gap on
  // the finer of the two leaves the smaller error.
  const remaining = Math.max(0, calories - protein * KCAL_PER_GRAM.protein);
  const ratio = CARB_FAT[goalType];
  const fat = Math.max(0, Math.round((remaining * ratio.fat) / KCAL_PER_GRAM.fat));
  const carbs = Math.max(
    0,
    Math.round((remaining - fat * KCAL_PER_GRAM.fat) / KCAL_PER_GRAM.carbs),
  );

  // The calorie goal then comes back out of the grams, not the other way
  // round. Rounding three macros to whole grams almost never lands back on
  // the number they were derived from, and the plan would otherwise ship a
  // calorie target its own macros contradict. See gramsForSplit for why the
  // grams win.
  const macros = { protein, carbs, fat };
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
