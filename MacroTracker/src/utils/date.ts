export function todayString(): string {
  const d = new Date();
  return formatDate(d);
}

export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * `n` calendar days from `ms`, at local midnight.
 *
 * Not `ms + n * 86400000`: a day is not always 86,400,000 ms. Across a DST
 * boundary that arithmetic lands an hour off, which is enough to name the
 * wrong day — stepping back to Sunday from Wed 4 Nov 2026 in New York gives
 * Sunday 01:00, and a session logged at that Sunday's midnight then sorts
 * *before* the start of its own week. setDate handles the offset and rolls
 * months and years on its own.
 */
export function addDays(ms: number, n: number): number {
  const d = new Date(ms);
  d.setDate(d.getDate() + n);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function displayDate(dateStr: string): string {
  const today = todayString();
  const yesterday = formatDate(new Date(Date.now() - 86400000));
  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  const d = parseDate(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * `n` days ending on `from` (today by default), newest first.
 *
 * Steps with `addDays` rather than subtracting 86,400,000 ms a time: the
 * arithmetic version lands an hour off across a DST boundary, which on the
 * two changeover weekends a year is enough to repeat or skip a day in the
 * week strip.
 */
export function getPastDays(n: number, from?: string): string[] {
  const anchor = parseDate(from ?? todayString()).getTime();
  const days: string[] = [];
  for (let i = 0; i < n; i++) {
    days.push(formatDate(new Date(addDays(anchor, -i))));
  }
  return days;
}

/** `n` days from a YYYY-MM-DD date, as a YYYY-MM-DD date. */
export function shiftDate(dateStr: string, n: number): string {
  return formatDate(new Date(addDays(parseDate(dateStr).getTime(), n)));
}

// "Oct 30" from a YYYY-MM-DD string.
export function shortDate(dateStr: string): string {
  return parseDate(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Compact relative label for a past YYYY-MM-DD date: "today", "yesterday",
// "3d ago", "2w ago", or a short month/day once it's further back.
export function relativeDateLabel(dateStr: string): string {
  const today = todayString();
  if (dateStr === today) return 'today';
  const then = parseDate(dateStr);
  const days = Math.round((parseDate(today).getTime() - then.getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 28) return `${Math.round(days / 7)}w ago`;
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Formats a millisecond duration as M:SS, or H:MM:SS once it passes an hour.
export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}
