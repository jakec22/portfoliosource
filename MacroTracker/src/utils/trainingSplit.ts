import { EXERCISE_CATALOG } from './exerciseList';
import { normalizeExerciseName } from './exerciseHistory';
import { formatDate, parseDate, todayString } from './date';
import type { Theme } from '../theme';
import type { WorkoutSession } from '../types';

export interface SplitSlice {
  category: string;
  /** Total volume (lb) for this category over the window. */
  volume: number;
  /** Share of total volume, 0–1. */
  share: number;
  color: string;
}

// Bucket for anything typed by hand that isn't in the catalog. The picker
// deliberately allows free-text names, so this is expected rather than an
// error — it just can't be attributed to a body part.
const OTHER = 'Other';

// Exact-name lookup built once from the catalog. Names are normalized the same
// way exercise history normalizes them, so "barbell bench press" and "Barbell
// Bench Press" land in the same bucket.
const CATEGORY_BY_NAME: Map<string, string> = (() => {
  const map = new Map<string, string>();
  for (const group of EXERCISE_CATALOG) {
    for (const name of group.exercises) {
      map.set(normalizeExerciseName(name), group.category);
    }
  }
  return map;
})();

/**
 * Which body part an exercise trains. Falls back to a substring match against
 * catalog entries before giving up — a logged "Incline Bench Press (Smith)"
 * should still count as Chest rather than silently becoming Other.
 */
export function categoryForExercise(name: string): string {
  const key = normalizeExerciseName(name);
  if (!key) return OTHER;
  const exact = CATEGORY_BY_NAME.get(key);
  if (exact) return exact;
  for (const [catalogName, category] of CATEGORY_BY_NAME) {
    if (key.includes(catalogName) || catalogName.includes(key)) return category;
  }
  return OTHER;
}

/** Palette for the split donut, drawn from the pack's own macro + zone hues. */
function sliceColors(c: Theme): string[] {
  return [
    c.macroProtein,
    c.macroCarbs,
    c.macroFat,
    c.macroFiber,
    c.hrZone1,
    c.hrZone4,
    c.info,
    c.textFaint, // reserved for the Other bucket, deliberately the quietest
  ];
}

/**
 * Training volume by body part over the last `days` days, largest first.
 * Returns [] when there's nothing to show so callers can hide the section.
 */
export function trainingSplit(
  history: WorkoutSession[],
  days: number,
  c: Theme
): SplitSlice[] {
  const cutoff = formatDate(new Date(Date.now() - (days - 1) * 86400000));
  const cutoffMs = parseDate(cutoff).getTime();

  const byCategory = new Map<string, number>();
  for (const session of history) {
    if (session.completedAt == null) continue;
    if (parseDate(session.date).getTime() < cutoffMs) continue;
    for (const ex of session.exercises) {
      let vol = 0;
      for (const set of ex.sets) {
        if (!set.completed) continue;
        vol += set.weight * set.reps;
      }
      // Bodyweight and time-based work logs no weight×reps volume, so count a
      // completed set as a unit of work instead of dropping the exercise from
      // the split entirely.
      if (vol === 0) {
        vol = ex.sets.filter((s) => s.completed).length;
      }
      if (vol <= 0) continue;
      const cat = categoryForExercise(ex.name);
      byCategory.set(cat, (byCategory.get(cat) ?? 0) + vol);
    }
  }

  const total = [...byCategory.values()].reduce((n, v) => n + v, 0);
  if (total <= 0) return [];

  const palette = sliceColors(c);
  return [...byCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category, volume], i) => ({
      category,
      volume,
      share: volume / total,
      // Other always takes the muted reserved color, whatever its rank.
      color: category === OTHER ? palette[palette.length - 1] : palette[i % (palette.length - 1)],
    }));
}

export interface ConsistencyStats {
  /** Workouts completed in the last 7 days. */
  thisWeek: number;
  /** Consecutive weeks (back from this one) with at least one workout. */
  weekStreak: number;
  totalSessions: number;
}

/** Headline training-consistency numbers for the Exercise tab. */
export function consistencyStats(history: WorkoutSession[]): ConsistencyStats {
  const done = history.filter((s) => s.completedAt != null);
  const todayMs = parseDate(todayString()).getTime();

  let thisWeek = 0;
  for (const s of done) {
    const daysAgo = Math.floor((todayMs - parseDate(s.date).getTime()) / 86400000);
    if (daysAgo >= 0 && daysAgo < 7) thisWeek += 1;
  }

  // Walk back week by week; the streak ends at the first empty week. The
  // current week doesn't break it when it's still empty — you haven't missed
  // it yet, it just hasn't happened.
  const weekHasWorkout = (weeksAgo: number): boolean =>
    done.some((s) => {
      const daysAgo = Math.floor((todayMs - parseDate(s.date).getTime()) / 86400000);
      return daysAgo >= weeksAgo * 7 && daysAgo < (weeksAgo + 1) * 7;
    });

  let weekStreak = 0;
  for (let w = weekHasWorkout(0) ? 0 : 1; w < 260; w++) {
    if (!weekHasWorkout(w)) break;
    weekStreak += 1;
  }

  return { thisWeek, weekStreak, totalSessions: done.length };
}
