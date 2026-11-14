import { supabase } from './supabase';
import { EXERCISE_CATALOG } from '../utils/exerciseList';
import { exerciseDemo } from '../data/exerciseDemos';
import { lastPerformance } from '../utils/exerciseHistory';
import type { Sex } from '../utils/tdee';
import type { TemplateExercise, UserProfile, WorkoutSession, WorkoutTemplate } from '../types';

/** What the user can lift with, as the sheet asks it. */
export type EquipmentAccess = 'gym' | 'home' | 'bodyweight';

/**
 * What they want out of training — which is not what they want out of eating.
 *
 * The function was already being told the nutrition goal from the profile, and
 * that is not the same question: somebody holding their weight steady can
 * still want to add 40 lb to their squat, and somebody in a deficit still has
 * to decide whether the lifting is there to build or to protect. Conflating
 * the two meant the single most important input to a program — what it is for
 * — was being inferred from a calorie target.
 *
 * These four drive rep ranges, how much isolation work appears, and whether
 * conditioning is in the week at all. The nutrition goal still goes too, as
 * secondary context about the calories available to recover on.
 */
export type TrainingGoal = 'muscle' | 'strength' | 'fatloss' | 'fitness';

export interface DesignRequest {
  days: number;
  minutes: number;
  equipment: EquipmentAccess;
  goal: TrainingGoal;
  // Prefilled from the profile where the Goal Wizard has run, and shown in
  // the sheet so it can be corrected. Optional because the wizard is skippable
  // and a missing answer is better than a guessed one.
  sex?: Sex;
  experience: 'new' | 'returning' | 'experienced';
}

/** One generated day, before it becomes a template. */
export interface PlannedDay {
  name: string;
  exercises: { name: string; sets: number; reps?: number; seconds?: number }[];
}

export interface DesignedPlan {
  name: string;
  note: string;
  days: PlannedDay[];
}

/**
 * The equipment tags each answer admits.
 *
 * Cardio is in every set because a program that cannot include conditioning
 * for someone training at home is worse for exactly the person this feature
 * is for. Kettlebell rides with the home set, which is where one usually is.
 */
const EQUIPMENT_FOR: Record<EquipmentAccess, string[]> = {
  gym: ['Barbell', 'Dumbbell', 'Machine', 'Cable', 'Bodyweight', 'Kettlebell', 'Cardio'],
  home: ['Dumbbell', 'Bodyweight', 'Kettlebell', 'Cardio'],
  bodyweight: ['Bodyweight', 'Cardio'],
};

/**
 * Which cardio each answer can actually do.
 *
 * The `Cardio` tag covers both a pair of trainers and a Concept2 rower, and
 * that distinction does not matter for "a gym" and matters entirely for the
 * other two. Without this, "Just me — no equipment at all" admitted fourteen
 * cardio exercises of which twelve need a machine, and a generated bodyweight
 * program duly finished its session on a Rowing Machine. Observed in a real
 * response, not guessed at.
 *
 * Split by what each answer promises rather than by what is plausible:
 * "no equipment at all" means exactly that, so it gets the two that need
 * nothing; "dumbbells at home" implies a rope but not an Assault Bike.
 * Everything else stays behind the gym answer, where there is one.
 */
const CARDIO_FOR: Partial<Record<EquipmentAccess, string[]>> = {
  bodyweight: ['Running', 'Walking'],
  home: ['Running', 'Walking', 'Jump Rope'],
};

/**
 * The exercises the model is allowed to choose from.
 *
 * Only ones with a demo, and only ones the user can actually perform. Both
 * halves matter. Without the demo filter it can return an exercise the app
 * cannot illustrate or describe, which is the one thing this feature exists
 * to avoid. Without the equipment filter it prescribes a cable crossover to
 * somebody in a bedroom — and filtering here rather than asking the model
 * nicely is what makes that impossible rather than unlikely.
 */
export function allowedExercises(equipment: EquipmentAccess): string[] {
  const ok = new Set(EQUIPMENT_FOR[equipment]);
  const cardio = CARDIO_FOR[equipment];
  const okCardio = cardio ? new Set(cardio) : null;
  const out: string[] = [];
  for (const group of EXERCISE_CATALOG) {
    for (const name of group.exercises) {
      const demo = exerciseDemo(name);
      if (!demo?.equipment || !ok.has(demo.equipment)) continue;
      // Cardio is the one tag that does not say what it needs, so for the two
      // answers that promise no machines it is narrowed by name.
      if (demo.equipment === 'Cardio' && okCardio && !okCardio.has(name)) continue;
      out.push(name);
    }
  }
  return out;
}

/** Ask the `design-workout` Edge Function for a program. */
export async function designPlan(
  req: DesignRequest,
  opts: { profile?: UserProfile; recentSplit?: Record<string, number> } = {}
): Promise<DesignedPlan> {
  const allowed = allowedExercises(req.equipment);
  if (allowed.length === 0) throw new Error('No exercises available for that equipment');

  const { data, error } = await supabase.functions.invoke('design-workout', {
    body: {
      allowed,
      days: req.days,
      minutes: req.minutes,
      experience: req.experience,
      // `goal` is the training goal they chose. The nutrition goal travels
      // under its own name now — the two were previously one field, which is
      // what made the program unable to tell "eating at a deficit" apart from
      // "training for fat loss".
      goal: req.goal,
      sex: req.sex,
      age: opts.profile?.age,
      nutritionGoal: opts.profile?.goalType,
      recent: opts.recentSplit,
    },
  });

  if (error) {
    // Supabase wraps the function's JSON error body in error.context; surface
    // the most useful message, as analyze-meal does.
    let detail = error.message;
    try {
      const body = await (error as any).context?.json?.();
      if (body?.error) detail = body.error;
    } catch {
      /* ignore — fall back to error.message */
    }
    throw new Error(detail);
  }

  const days: PlannedDay[] = (Array.isArray(data?.days) ? data.days : [])
    .map((d: any) => ({
      name: String(d?.name ?? 'Workout'),
      exercises: (Array.isArray(d?.exercises) ? d.exercises : [])
        // The function filters too; this is the client refusing to display a
        // name it cannot resolve to a demo.
        .filter((e: any) => exerciseDemo(String(e?.name)))
        .map((e: any) => ({
          name: String(e.name),
          sets: Math.max(1, Math.min(10, Math.round(Number(e.sets) || 3))),
          reps: Number(e.reps) > 0 ? Math.round(Number(e.reps)) : undefined,
          seconds: Number(e.seconds) > 0 ? Math.round(Number(e.seconds)) : undefined,
        })),
    }))
    .filter((d: PlannedDay) => d.exercises.length > 0);

  if (days.length === 0) throw new Error('The program came back empty');

  return {
    name: String(data?.name ?? 'Training program'),
    note: String(data?.note ?? ''),
    days,
  };
}

/**
 * Turn a generated day into a saved workout.
 *
 * The weight is the part worth reading. The model never sends one — it has
 * not seen this person lift, and a prescribed load is the one thing in a
 * generated program that could actually hurt somebody. So it comes from
 * their own last performance of that exercise, and where there is no history
 * it stays 0, which the app shows as blank and the watch as "BW". A number
 * they have lifted before, or no number at all.
 */
export function planDayToTemplate(
  day: PlannedDay,
  history: WorkoutSession[],
  createdAt: number
): WorkoutTemplate {
  const exercises: TemplateExercise[] = day.exercises.map((ex, ei) => {
    const last = lastPerformance(history, ex.name);
    const seed = last?.sets?.[0]?.weight ?? 0;
    const isTime = ex.seconds != null && ex.reps == null;

    return {
      id: `gen-${createdAt}-${ei}`,
      name: ex.name,
      mode: isTime ? 'time' : undefined,
      sets: Array.from({ length: ex.sets }, (_, si) => ({
        id: `gen-${createdAt}-${ei}-${si}`,
        weight: seed,
        reps: isTime ? 0 : (ex.reps ?? 10),
        durationSeconds: isTime ? ex.seconds : undefined,
      })),
    };
  });

  return {
    id: `tpl-${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
    name: day.name,
    exercises,
    createdAt,
  };
}
