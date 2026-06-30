import type { SetType, WorkoutExercise, WorkoutSession } from '../types';
import { formatDuration } from './duration';

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
  durationSeconds?: number; // set for time-based exercises
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
  maxDuration: number; // longest single set, seconds (time-based exercises)
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
    .filter((s) => s.reps > 0 || (s.durationSeconds ?? 0) > 0)
    .map((s) => ({ weight: s.weight, reps: s.reps, durationSeconds: s.durationSeconds }));
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
  durationSeconds?: number;
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
    return prev
      ? { ...ps, weight: prev.weight, reps: prev.reps, durationSeconds: prev.durationSeconds }
      : ps;
  });
  for (; i < last.sets.length; i++) {
    const s = last.sets[i];
    out.push({ weight: s.weight, reps: s.reps, durationSeconds: s.durationSeconds });
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
  let maxDuration = 0;
  for (const p of perfs) {
    let volume = 0;
    for (const s of p.sets) {
      if (s.weight > maxWeight) maxWeight = s.weight;
      if (s.reps > maxReps) maxReps = s.reps;
      const orm = estimate1RM(s.weight, s.reps);
      if (orm > best1RM) best1RM = orm;
      volume += s.weight * s.reps;
      if ((s.durationSeconds ?? 0) > maxDuration) maxDuration = s.durationSeconds!;
    }
    if (volume > maxVolume) maxVolume = volume;
  }
  return { maxWeight, best1RM, maxReps, maxVolume, maxDuration };
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
  newDuration?: number; // seconds (time-based exercises)
  prevDuration?: number;
}

// Format a list of performed sets compactly, e.g. "135×8, 135×8, 135×7" for
// rep sets, or "1:00, 0:45" / "25×1:00" for time-based sets.
export function formatPerformedSets(sets: PerformedSet[]): string {
  return sets
    .map((s) => {
      if ((s.durationSeconds ?? 0) > 0) {
        const t = formatDuration(s.durationSeconds!);
        return s.weight > 0 ? `${s.weight}×${t}` : t;
      }
      return s.weight > 0 ? `${s.weight}×${s.reps}` : `${s.reps}`;
    })
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
    let curDuration = 0;
    for (const s of sets) {
      if (s.weight > curWeight) curWeight = s.weight;
      const orm = estimate1RM(s.weight, s.reps);
      if (orm > cur1RM) cur1RM = orm;
      curVolume += s.weight * s.reps;
      if ((s.durationSeconds ?? 0) > curDuration) curDuration = s.durationSeconds!;
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
    if (prev.maxDuration > 0 && curDuration > prev.maxDuration) {
      pr.newDuration = curDuration;
      pr.prevDuration = prev.maxDuration;
      isPR = true;
    }
    if (isPR) prs.push(pr);
  }
  return prs;
}

// One session's worth of metrics for an exercise, for plotting progress.
export interface ExerciseSessionPoint {
  sessionId: string;
  date: string;
  completedAt: number;
  topWeight: number; // heaviest working set
  best1RM: number; // best estimated one-rep max (rounded)
  volume: number; // Σ weight × reps (rounded)
  maxReps: number; // most reps in a single set
  maxDuration: number; // longest single set, seconds (time-based exercises)
  sets: PerformedSet[];
}

// Per-session metric series for one exercise, oldest first (left→right for a
// chart). Only sessions where the exercise has working sets are included.
export function exerciseSeries(
  history: WorkoutSession[],
  exerciseName: string
): ExerciseSessionPoint[] {
  // exerciseHistory is newest-first; reverse to oldest-first for charting.
  return exerciseHistory(history, exerciseName)
    .map((p) => {
      let topWeight = 0;
      let best1RM = 0;
      let volume = 0;
      let maxReps = 0;
      let maxDuration = 0;
      for (const s of p.sets) {
        if (s.weight > topWeight) topWeight = s.weight;
        if (s.reps > maxReps) maxReps = s.reps;
        const orm = estimate1RM(s.weight, s.reps);
        if (orm > best1RM) best1RM = orm;
        volume += s.weight * s.reps;
        if ((s.durationSeconds ?? 0) > maxDuration) maxDuration = s.durationSeconds!;
      }
      return {
        sessionId: p.sessionId,
        date: p.date,
        completedAt: p.completedAt,
        topWeight,
        best1RM: Math.round(best1RM),
        volume: Math.round(volume),
        maxReps,
        maxDuration,
        sets: p.sets,
      };
    })
    .reverse();
}

// A one-line roll-up of an exercise for a browsable list.
export interface ExerciseSummary {
  name: string; // display name (most recent casing)
  key: string; // normalized match key
  sessions: number; // times performed
  lastDate: string;
  lastCompletedAt: number;
  bestWeight: number;
  best1RM: number;
}

// Roll up every exercise the user has performed into summary rows, most
// recently performed first. Relies on `history` being newest-first so the
// first sighting of a name supplies its display casing and last date.
export function exerciseSummaries(history: WorkoutSession[]): ExerciseSummary[] {
  const map = new Map<string, ExerciseSummary>();
  for (const session of history) {
    const completedAt = session.completedAt ?? session.startedAt;
    for (const ex of session.exercises) {
      const sets = effectiveSets(ex);
      if (sets.length === 0) continue;
      let topWeight = 0;
      let best1RM = 0;
      for (const s of sets) {
        if (s.weight > topWeight) topWeight = s.weight;
        const orm = estimate1RM(s.weight, s.reps);
        if (orm > best1RM) best1RM = orm;
      }
      const key = normalizeExerciseName(ex.name);
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          name: ex.name,
          key,
          sessions: 1,
          lastDate: session.date,
          lastCompletedAt: completedAt,
          bestWeight: topWeight,
          best1RM: Math.round(best1RM),
        });
      } else {
        existing.sessions += 1;
        if (topWeight > existing.bestWeight) existing.bestWeight = topWeight;
        if (Math.round(best1RM) > existing.best1RM) existing.best1RM = Math.round(best1RM);
      }
    }
  }
  return [...map.values()].sort((a, b) => b.lastCompletedAt - a.lastCompletedAt);
}

// A sparkline-ready progress summary for one exercise: the headline metric's
// per-session series plus its latest value and change since last session.
export interface ProgressCard {
  name: string;
  key: string;
  values: number[]; // headline metric per session, oldest → newest
  latest: number;
  previous: number | null;
  metricLabel: string; // e.g. "Est. 1RM", "Best hold"
  isTime: boolean; // true → values are seconds (format as m:ss)
  unit: string; // "lb" for weight metrics, "" otherwise
}

// Pick the most meaningful headline metric for an exercise: hold time for
// time-based work, else estimated 1RM / top weight for weighted lifts, else
// reps for bodyweight rep work.
function pickProgressMetric(series: ExerciseSessionPoint[]): {
  get: (p: ExerciseSessionPoint) => number;
  label: string;
  isTime: boolean;
  unit: string;
} {
  if (series.some((p) => p.maxDuration > 0))
    return { get: (p) => p.maxDuration, label: 'Best hold', isTime: true, unit: '' };
  if (series.some((p) => p.best1RM > 0))
    return { get: (p) => p.best1RM, label: 'Est. 1RM', isTime: false, unit: 'lb' };
  if (series.some((p) => p.topWeight > 0))
    return { get: (p) => p.topWeight, label: 'Top weight', isTime: false, unit: 'lb' };
  return { get: (p) => p.maxReps, label: 'Max reps', isTime: false, unit: '' };
}

// Build progress cards for every exercise with history, most-recently performed
// first (mirrors exerciseSummaries ordering).
export function exerciseProgressCards(history: WorkoutSession[]): ProgressCard[] {
  const cards: ProgressCard[] = [];
  for (const s of exerciseSummaries(history)) {
    const series = exerciseSeries(history, s.name); // oldest → newest
    if (series.length === 0) continue;
    const m = pickProgressMetric(series);
    const values = series.map(m.get);
    cards.push({
      name: s.name,
      key: s.key,
      values,
      latest: values[values.length - 1],
      previous: values.length >= 2 ? values[values.length - 2] : null,
      metricLabel: m.label,
      isTime: m.isTime,
      unit: m.unit,
    });
  }
  return cards;
}

// The exercises that improved most in their latest session, for a "top movers"
// highlight. Only exercises with at least two sessions and a positive change
// qualify; ranked by absolute gain in the headline metric.
export function topMovers(history: WorkoutSession[], limit = 3): ProgressCard[] {
  return exerciseProgressCards(history)
    .filter((c) => c.previous != null && c.latest > c.previous)
    .sort((a, b) => b.latest - b.previous! - (a.latest - a.previous!))
    .slice(0, limit);
}

// A single recently-set personal record, formatted for display.
export interface RecentPR {
  name: string;
  label: string; // metric that was beaten
  value: string; // new record, formatted
  prev: string; // previous best, formatted
}

// Personal records set across the most recent sessions, newest first, one entry
// per exercise (its best/most-impressive dimension).
export function recentPRs(history: WorkoutSession[], sessionLimit = 4): RecentPR[] {
  const out: RecentPR[] = [];
  const seen = new Set<string>();
  for (const session of history.slice(0, sessionLimit)) {
    for (const pr of detectSessionPRs(session, history)) {
      const k = normalizeExerciseName(pr.name);
      if (seen.has(k)) continue; // keep only the most recent PR per exercise
      seen.add(k);
      if (pr.newWeight != null) {
        out.push({ name: pr.name, label: 'Top weight', value: `${pr.newWeight} lb`, prev: `${pr.prevWeight} lb` });
      } else if (pr.new1RM != null) {
        out.push({ name: pr.name, label: 'Est. 1RM', value: `${pr.new1RM} lb`, prev: `${pr.prev1RM} lb` });
      } else if (pr.newDuration != null) {
        out.push({ name: pr.name, label: 'Longest hold', value: formatDuration(pr.newDuration), prev: formatDuration(pr.prevDuration!) });
      } else if (pr.newVolume != null) {
        out.push({ name: pr.name, label: 'Volume', value: `${pr.newVolume.toLocaleString()} lb`, prev: `${pr.prevVolume!.toLocaleString()} lb` });
      }
    }
  }
  return out;
}
