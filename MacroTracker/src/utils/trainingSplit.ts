import { EXERCISE_CATALOG } from './exerciseList';
import { normalizeExerciseName } from './exerciseHistory';
import { addDays, formatDate, parseDate, todayString } from './date';
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

// Last resort before Other: the words gyms actually print on machines. A name
// typed at the rack is usually a variant nobody put in the catalog — "Iso
// Lateral Decline Press", "Seated Row Machine" — but it almost always contains
// a word that places it. Order matters: the first match wins, so the more
// specific terms come first ("leg curl" before "curl", or every curl is Legs).
const CATEGORY_KEYWORDS: ReadonlyArray<readonly [string, string]> = [
  ['leg curl', 'Legs'], ['leg extension', 'Legs'], ['leg press', 'Legs'],
  ['calf', 'Legs'], ['squat', 'Legs'], ['lunge', 'Legs'], ['hip thrust', 'Legs'],
  ['glute', 'Legs'], ['hamstring', 'Legs'], ['quad', 'Legs'], ['abduct', 'Legs'],
  ['adduct', 'Legs'], ['step-up', 'Legs'], ['step up', 'Legs'],
  ['deadlift', 'Back'], ['pulldown', 'Back'], ['pull-up', 'Back'], ['pull up', 'Back'],
  ['chin-up', 'Back'], ['chin up', 'Back'], ['row', 'Back'], ['shrug', 'Back'],
  ['lat ', 'Back'], ['back extension', 'Back'], ['pullover', 'Back'],
  ['bench', 'Chest'], ['chest', 'Chest'], ['pec ', 'Chest'], ['push-up', 'Chest'],
  ['push up', 'Chest'], ['dip', 'Chest'], ['crossover', 'Chest'],
  ['lateral raise', 'Shoulders'], ['rear delt', 'Shoulders'], ['delt', 'Shoulders'],
  ['overhead press', 'Shoulders'], ['shoulder', 'Shoulders'], ['front raise', 'Shoulders'],
  ['upright row', 'Shoulders'], ['arnold', 'Shoulders'],
  ['tricep', 'Arms'], ['bicep', 'Arms'], ['curl', 'Arms'], ['pushdown', 'Arms'],
  ['skull crusher', 'Arms'], ['wrist', 'Arms'], ['forearm', 'Arms'],
  ['plank', 'Core'], ['crunch', 'Core'], ['ab ', 'Core'], ['abs', 'Core'],
  ['oblique', 'Core'], ['sit-up', 'Core'], ['sit up', 'Core'], ['leg raise', 'Core'],
  ['russian twist', 'Core'], ['woodchop', 'Core'], ['pallof', 'Core'],
  ['treadmill', 'Cardio'], ['bike', 'Cardio'], ['cycl', 'Cardio'], ['run', 'Cardio'],
  ['walk', 'Cardio'], ['elliptical', 'Cardio'], ['stair', 'Cardio'], ['erg', 'Cardio'],
  ['rowing machine', 'Cardio'], ['jump rope', 'Cardio'], ['swim', 'Cardio'], ['sled', 'Cardio'],
  ['clean', 'Full Body'], ['snatch', 'Full Body'], ['thruster', 'Full Body'],
  ['burpee', 'Full Body'], ['kettlebell swing', 'Full Body'], ['carry', 'Full Body'],
  // Last, so every specific press above wins first. A press that has reached
  // this line is a chest machine under a brand name — "Iso-Lateral Decline
  // Press" and its relatives.
  ['decline', 'Chest'], ['press', 'Chest'],
];

/**
 * Which body part an exercise trains. Three passes, narrowing: the catalog by
 * exact name, then by substring, then the keyword table above.
 *
 * The keyword pass is what keeps a typed-in machine name off the Other pile.
 * Without it anything the catalog had not heard of went unattributed, so it
 * vanished from the training split and showed as untrained on the body map —
 * which is the opposite of true for someone who had just trained it.
 */
export function categoryForExercise(name: string): string {
  const key = normalizeExerciseName(name);
  if (!key) return OTHER;
  const exact = CATEGORY_BY_NAME.get(key);
  if (exact) return exact;
  for (const [catalogName, category] of CATEGORY_BY_NAME) {
    if (key.includes(catalogName) || catalogName.includes(key)) return category;
  }
  for (const [word, category] of CATEGORY_KEYWORDS) {
    if (key.includes(word)) return category;
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

/**
 * Midnight on the Sunday that starts the week containing `ms`.
 *
 * One definition of "a week", used by the consistency ring and by the
 * calendar grid. They disagreed before this existed: the ring counted a
 * rolling trailing seven days while the grid drew Monday-to-Sunday columns,
 * so on any day but Sunday the two said different things about the same
 * training on the same screen.
 */
export function weekStartMs(ms: number): number {
  // getDay() is already 0 = Sunday, which is the week start we want.
  return addDays(ms, -new Date(ms).getDay());
}

export interface ConsistencyStats {
  /** Workouts completed since Sunday, this calendar week. */
  thisWeek: number;
  /** Consecutive calendar weeks (back from this one) with at least one workout. */
  weekStreak: number;
  totalSessions: number;
}

/** Headline training-consistency numbers for the Exercise tab. */
export function consistencyStats(history: WorkoutSession[]): ConsistencyStats {
  const done = history.filter((s) => s.completedAt != null);
  const todayMs = parseDate(todayString()).getTime();
  const thisWeekStart = weekStartMs(todayMs);

  // Sunday to today, not the trailing seven days. The rolling window meant
  // the ring could fall without anyone missing a session: train Mon-Wed and
  // the next Monday your Monday aged out, so "3 of 4" became "2 of 4" during
  // a week you had trained every one of. A calendar week also gives the goal
  // a real reset, which is what "1 to go this week" was already implying.
  let thisWeek = 0;
  for (const s of done) {
    const dayMs = parseDate(s.date).getTime();
    if (dayMs >= thisWeekStart && dayMs <= todayMs) thisWeek += 1;
  }

  // Walk back week by week; the streak ends at the first empty week. The
  // current week doesn't break it when it's still empty — you haven't missed
  // it yet, it just hasn't happened.
  const weekHasWorkout = (weeksAgo: number): boolean => {
    const start = addDays(thisWeekStart, -weeksAgo * 7);
    const end = addDays(start, 7);
    return done.some((s) => {
      const dayMs = parseDate(s.date).getTime();
      return dayMs >= start && dayMs < end;
    });
  };

  let weekStreak = 0;
  for (let w = weekHasWorkout(0) ? 0 : 1; w < 260; w++) {
    if (!weekHasWorkout(w)) break;
    weekStreak += 1;
  }

  return { thisWeek, weekStreak, totalSessions: done.length };
}

export interface CalendarDay {
  date: string; // YYYY-MM-DD
  volume: number;
  /** 0–1 against the window's busiest day; 0 when untrained. */
  intensity: number;
  /** True for days after today in the trailing week. */
  future: boolean;
}

export interface TrainingCalendar {
  /** Columns, oldest → newest. Each is a Sun→Sat week. */
  weeks: CalendarDay[][];
  sessions: number;
  /** Longest run of consecutive untrained days inside the window. */
  longestGapDays: number;
  /** Month labels aligned to week columns; '' where the month repeats. */
  monthLabels: string[];
}

/**
 * Per-day training volume over the trailing `weeks` weeks, laid out as Mon→Sun
 * columns for a contribution-style grid. Surfaces rhythm and gaps, which the
 * consistency ring (a single week) and the split donut (totals) can't show.
 */
export function trainingCalendar(history: WorkoutSession[], weeks = 12): TrainingCalendar {
  const volumeByDate = new Map<string, number>();
  let sessions = 0;

  const todayMs = parseDate(todayString()).getTime();
  // Sunday of the current week, so the grid always ends on a whole week and
  // its columns line up with the weeks the consistency ring counts.
  const startMs = addDays(weekStartMs(todayMs), -(weeks - 1) * 7);

  for (const s of history) {
    if (s.completedAt == null) continue;
    const dayMs = parseDate(s.date).getTime();
    if (dayMs < startMs || dayMs > todayMs) continue;
    sessions += 1;
    let vol = 0;
    for (const ex of s.exercises) {
      for (const set of ex.sets) {
        if (!set.completed) continue;
        vol += set.weight * set.reps || 1; // bodyweight/time sets still count
      }
    }
    volumeByDate.set(s.date, (volumeByDate.get(s.date) ?? 0) + vol);
  }

  const maxVolume = Math.max(...volumeByDate.values(), 0);

  const grid: CalendarDay[][] = [];
  const monthLabels: string[] = [];
  let lastMonth = '';
  let gap = 0;
  let longestGapDays = 0;

  for (let w = 0; w < weeks; w++) {
    const week: CalendarDay[] = [];
    for (let d = 0; d < 7; d++) {
      const ms = addDays(startMs, w * 7 + d);
      const date = formatDate(new Date(ms));
      const volume = volumeByDate.get(date) ?? 0;
      const future = ms > todayMs;

      if (!future) {
        if (volume > 0) {
          gap = 0;
        } else {
          gap += 1;
          if (gap > longestGapDays) longestGapDays = gap;
        }
      }

      week.push({
        date,
        volume,
        intensity: volume > 0 && maxVolume > 0 ? volume / maxVolume : 0,
        future,
      });
    }
    grid.push(week);

    // Label a column only when its month differs from the previous one, so
    // the axis reads "Jul … Aug … Sep" rather than repeating every column.
    const month = new Date(startMs + w * 7 * 86400000).toLocaleDateString('en-US', {
      month: 'short',
    });
    monthLabels.push(month === lastMonth ? '' : month);
    lastMonth = month;
  }

  return { weeks: grid, sessions, longestGapDays, monthLabels };
}
