// Date helpers. Months are keyed "YYYY-MM"; all boundaries are computed in the
// device's local calendar/timezone (never UTC), so a purchase logged at 11pm
// lands in the right month.

export interface MonthPosition {
  /** Day of month, 1-based. */
  day: number;
  /** Total days in the month. */
  total: number;
  /** Fraction of the month elapsed, day/total in (0, 1]. */
  pct: number;
  /** "July 2026" */
  label: string;
  /** "2026-07" */
  key: string;
}

/** Month key "YYYY-MM" for a given date (local time). */
export function monthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** ISO local date "YYYY-MM-DD" (not UTC). */
export function isoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** "July 2026" from a "YYYY-MM" key. */
export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

/** Position within the month for the runway bar's day marker. */
export function monthPosition(now: Date): MonthPosition {
  const year = now.getFullYear();
  const month = now.getMonth();
  const total = new Date(year, month + 1, 0).getDate();
  const day = now.getDate();
  return {
    day,
    total,
    pct: day / total,
    label: now.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
    key: monthKey(now),
  };
}
