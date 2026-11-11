import { addDays, parseDate, shortDate, formatDate, todayString } from './date';
import { weekStartMs } from './trainingSplit';
import { isRecoverySession, RECOVERY_TYPES, type RecoveryKind } from './workoutTypes';
import type { WorkoutSession } from '../types';

/**
 * Heat and cold, counted the way people actually aim at them.
 *
 * Recovery is deliberately absent from every training figure in the app —
 * the consistency ring, the week streak, the calendar, the body map all
 * exclude it, so that "3 of 4 this week" keeps meaning three lifts rather
 * than three visits to a sauna. That rule is right and stays, but it left
 * recovery with nowhere to be counted *at all*: a sauna went in, produced a
 * recap, and then vanished from every summary on the Exercise tab.
 *
 * What it wants is its own unit. Lifting is counted in sessions against a
 * weekly target because a session is the thing you either did or didn't do.
 * Heat and cold are counted in minutes, because fifteen minutes is the
 * point and three five-minute saunas are not the same as one fifteen —
 * except that they roughly are, which is exactly why the total is the
 * honest figure and the session count is the footnote.
 *
 * Kinds are counted apart because they are aimed at apart. Nobody has a
 * combined heat-and-cold target.
 */

export interface RecoveryWeek {
  /** Midnight on the Sunday that starts the week. */
  startMs: number;
  /** Total held time across the week, in ms. */
  ms: number;
  sessions: number;
}

export interface RecoverySummary {
  kind: RecoveryKind;
  label: string;
  /** Oldest first, one entry per week, every week present even when empty. */
  weeks: RecoveryWeek[];
  /** The current week — the last entry in `weeks`. */
  thisWeek: RecoveryWeek;
  /** The one before it, for the delta. Null when the window is one week. */
  lastWeek: RecoveryWeek | null;
  /** All-time sessions of this kind. Drives whether the kind is shown. */
  total: number;
}

/** Held time for one session, in ms. Never negative. */
export function heldMs(s: WorkoutSession): number {
  return Math.max(0, (s.completedAt ?? s.startedAt) - s.startedAt);
}

/**
 * Sessions of one recovery kind, bucketed into the last `weeks` calendar
 * weeks ending with the one containing `anchor`.
 *
 * Matched on name, which is what tells a sauna from a plunge — both carry
 * HKWorkoutActivityTypeOther, since Apple has no type for either.
 *
 * Sunday-aligned via weekStartMs, the app's one definition of a week, so
 * this figure and the one on a session's own recap can never disagree about
 * which week a Saturday sauna belonged to.
 */
export function recoverySummary(
  history: WorkoutSession[],
  kind: RecoveryKind,
  weeks: number,
  anchor?: string
): RecoverySummary {
  const type = RECOVERY_TYPES.find((r) => r.kind === kind) ?? RECOVERY_TYPES[0];
  const thisWeekStart = weekStartMs(parseDate(anchor ?? todayString()).getTime());
  const firstWeekStart = addDays(thisWeekStart, -(weeks - 1) * 7);

  const buckets: RecoveryWeek[] = [];
  for (let i = 0; i < weeks; i++) {
    buckets.push({ startMs: addDays(firstWeekStart, i * 7), ms: 0, sessions: 0 });
  }

  let total = 0;
  for (const s of history) {
    if (!isRecoverySession(s) || s.name !== type.label) continue;
    total += 1;
    // Matched on the week's own start rather than by arithmetic on the gap:
    // both sides come from weekStartMs/addDays and are therefore exact local
    // midnights, so equality holds across a DST boundary where dividing a
    // millisecond difference by seven days does not. A session outside the
    // window — older than the first bucket, or later than the anchor's own
    // week — simply matches nothing.
    const start = weekStartMs(parseDate(s.date).getTime());
    const bucket = buckets.find((b) => b.startMs === start);
    if (!bucket) continue;
    bucket.ms += heldMs(s);
    bucket.sessions += 1;
  }

  return {
    kind,
    label: type.label,
    weeks: buckets,
    thisWeek: buckets[buckets.length - 1],
    lastWeek: buckets.length > 1 ? buckets[buckets.length - 2] : null,
    total,
  };
}

/** Every kind that has ever been logged, in the order the start sheet lists them. */
export function recoverySummaries(
  history: WorkoutSession[],
  weeks: number,
  anchor?: string
): RecoverySummary[] {
  return RECOVERY_TYPES.map((t) => recoverySummary(history, t.kind, weeks, anchor)).filter(
    (s) => s.total > 0
  );
}

/**
 * A running total, rounded to the minute.
 *
 * Not formatDuration, which renders a clock: "48:00" is the right shape for
 * one session's stopwatch and the wrong one for a week's accumulation,
 * where it invites being read as a time of day.
 */
export function totalLabel(ms: number): string {
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} hr` : `${h}h ${m}m`;
}

/** "Week of Oct 12", for a bar's accessibility label. */
export function weekLabel(startMs: number): string {
  return `Week of ${shortDate(formatDate(new Date(startMs)))}`;
}
