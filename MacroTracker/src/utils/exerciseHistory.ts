import type { SetType, WorkoutExercise, WorkoutSession } from '../types';

/**
 * Progressive-overload helpers: derive per-exercise history, bests, and
 * personal records from completed workout sessions.
 *
 * Exercises are matched across sessions by their (normalized) name, since
 * that's the only stable identifier the user provides. Warm-up sets are
 * excluded from all strength calculations — only working sets count.
 */

export interface PerformedSet {
  weight: number; // lbs (0 = bodyweight / unspecified)
  reps: number;
}

// One exercise's working sets within a single session.
export interface ExercisePerformance {
  sessionId: string;
  date: string; // YYYY-MM-DD
  completedAt: number; // ms epoch; falls back to startedAt
  sets: PerformedSet[];
}

export interface ExerciseBests {
  maxWeight: number; // heaviest weight on any single set
  best1RM: number; // best estimated one-rep max
  maxReps: number; // most reps in a single set
  maxVolume: number; // highest single-session volume (Σ weight × reps)
}

export function normalizeExerciseName(name: string): string {
  return name.trim().toLowerCase();
}

// Epley estimated one-rep max. Bodyweight / empty sets yield 0.
export function estimate1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

// The working sets that "count" for a logged exercise: completed, non-warmup
// sets if any were checked off, otherwise all non-warmup sets (supports users
// who log without ticking each set). Empty rows (no reps) are dropped.
function effectiveSets(ex: WorkoutExercise): PerformedSet[] {
  const completed = ex.sets.filter((s) => s.completed && s.type !== 'warmup');
  const base = completed.length
    ? completed
    : ex.sets.filter((s) => s.type !== 'warmup');
  return base
    .filter((s) => s.reps > 0)
    .map((s) => ({ weight: s.weight, reps: s.reps }));
}

// All past performances of an exercise across history, newest first.
export function exerciseHistory(
  history: WorkoutSession[],
  exerciseName: string,
  excludeSessionId?: string
): ExercisePerformance[] {
  const key = normalizeExerciseName(exerciseName);
  const out: ExercisePerformance[] = [];
  for (const session of history) {
    if (excludeSessionId && session.id === excludeSessionId) continue;
    for (const ex of session.exercises) {
      if (normalizeExerciseName(ex.name) !== key) continue;
      const sets = effectiveSets(ex);
      if (sets.length === 0) continue;
      out.push({
        sessionId: session.id,
        date: session.date,
        completedAt: session.completedAt ?? session.startedAt,
        sets,
      });
    }
  }
  return out.sort((a, b) => b.completedAt - a.completedAt);
}

// The most recent prior performance of an exercise, or null if it's new.
export function lastPerformance(
  history: WorkoutSession[],
  exerciseName: string,
  excludeSessionId?: string
): ExercisePerformance | null {
  return exerciseHistory(history, exerciseName, excludeSessionId)[0] ?? null;
}

// A planned set used to seed a new active-workout exercise.
export interface PrefillSet {
  weight: number;
  reps: number;
  type?: SetType;
}

// Overlay the weights/reps from the last time an exercise was performed onto a
// set of planned sets, so a new session starts pre-filled for progressive
// overload — "start where you left off, then beat it." Warm-up sets keep their
// planned values; working sets are filled from history in order, and any extra
// working sets done last time are carried forward. With no prior history the
// planned sets are returned unchanged.
export function prefillFromLastPerformance(
  history: WorkoutSession[],
  exerciseName: string,
  planned: PrefillSet[]
): PrefillSet[] {
  const last = lastPerformance(history, exerciseName);
  if (!last || last.sets.length === 0) return planned;
  let i = 0;
  const out: PrefillSet[] = planned.map((ps) => {
    if (ps.type === 'warmup') return ps;
    const prev = last.sets[i++];
    return prev ? { ...ps, weight: prev.weight, reps: prev.reps } : ps;
  });
  for (; i < last.sets.length; i++) {
    out.push({ weight: last.sets[i].weight, reps: last.sets[i].reps });
  }
  return out;
}

// Best-ever marks for an exercise across history.
export function exerciseBests(
  history: WorkoutSession[],
  exerciseName: string,
  excludeSessionId?: string
): ExerciseBests {
  const perfs = exerciseHistory(history, exerciseName, excludeSessionId);
  let maxWeight = 0;
  let best1RM = 0;
  let maxReps = 0;
  let maxVolume = 0;
  for (const p of perfs) {
    let volume = 0;
    for (const s of p.sets) {
      if (s.weight > maxWeight) maxWeight = s.weight;
      if (s.reps > maxReps) maxReps = s.reps;
      const orm = estimate1RM(s.weight, s.reps);
      if (orm > best1RM) best1RM = orm;
      volume += s.weight * s.reps;
    }
    if (volume > maxVolume) maxVolume = volume;
  }
  return { maxWeight, best1RM, maxReps, maxVolume };
}

// A personal record set in a session, relative to all prior history.
export interface ExercisePR {
  name: string;
  newWeight?: number;
  prevWeight?: number;
  new1RM?: number;
  prev1RM?: number;
  newVolume?: number;
  prevVolume?: number;
}

// Format a list of performed sets compactly, e.g. "135×8, 135×8, 135×7".
export function formatPerformedSets(sets: PerformedSet[]): string {
  return sets
    .map((s) => (s.weight > 0 ? `${s.weight}×${s.reps}` : `${s.reps}`))
    .join(', ');
}

// Compare a (just-finished) session against the rest of history and return the
// exercises that set a new record. A first-ever performance is NOT a PR — there
// has to be a prior mark to beat.
export function detectSessionPRs(
  session: WorkoutSession,
  history: WorkoutSession[]
): ExercisePR[] {
  const prs: ExercisePR[] = [];
  for (const ex of session.exercises) {
    const sets = effectiveSets(ex);
    if (sets.length === 0) continue;

    let curWeight = 0;
    let cur1RM = 0;
    let curVolume = 0;
    for (const s of sets) {
      if (s.weight > curWeight) curWeight = s.weight;
      const orm = estimate1RM(s.weight, s.reps);
      if (orm > cur1RM) cur1RM = orm;
      curVolume += s.weight * s.reps;
    }

    const prev = exerciseBests(history, ex.name, session.id);
    const pr: ExercisePR = { name: ex.name };
    let isPR = false;
    if (prev.maxWeight > 0 && curWeight > prev.maxWeight) {
      pr.newWeight = curWeight;
      pr.prevWeight = prev.maxWeight;
      isPR = true;
    }
    if (prev.best1RM > 0 && cur1RM > prev.best1RM) {
      pr.new1RM = Math.round(cur1RM);
      pr.prev1RM = Math.round(prev.best1RM);
      isPR = true;
    }
    if (prev.maxVolume > 0 && curVolume > prev.maxVolume) {
      pr.newVolume = Math.round(curVolume);
      pr.prevVolume = Math.round(prev.maxVolume);
      isPR = true;
    }
    if (isPR) prs.push(pr);
  }
  return prs;
}
