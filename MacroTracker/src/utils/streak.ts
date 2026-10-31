import type { FoodEntry } from '../types';
import { formatDate, parseDate, todayString } from './date';

// Local calendar day throughout. Entries are keyed by the user's local day
// (addEntry -> todayString), so deriving "today" from toISOString() here read
// a UTC day and disagreed with its own data: east of UTC a breakfast logged at
// 8am counted for no day at all, and west of UTC an evening with nothing
// logged yet aged yesterday out of the streak.
function dateOffset(dateStr: string, days: number): string {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

/**
 * Computes current and all-time best logging streaks from the food log.
 * A day "counts" if it has at least one logged food entry.
 * The current streak remains active if the user hasn't logged today yet
 * but logged yesterday (i.e. they still have the rest of today).
 */
export function computeStreak(
  logs: Record<string, FoodEntry[]>,
): { current: number; best: number } {
  // Collect dates that have at least one entry, sorted newest first.
  const datesWithEntries = Object.entries(logs)
    .filter(([, entries]) => entries.length > 0)
    .map(([date]) => date)
    .sort()
    .reverse();

  if (datesWithEntries.length === 0) return { current: 0, best: 0 };

  // Current streak starts from today or yesterday.
  const today = todayString();
  const yesterday = dateOffset(today, -1);
  const newestLogged = datesWithEntries[0];

  let current = 0;
  if (newestLogged === today || newestLogged === yesterday) {
    let cursor = newestLogged;
    for (const date of datesWithEntries) {
      if (date === cursor) {
        current++;
        cursor = dateOffset(cursor, -1);
      } else {
        break;
      }
    }
  }

  // Best-ever streak: scan in ascending order.
  let best = 0;
  let run = 0;
  let prev = '';
  for (const date of [...datesWithEntries].reverse()) {
    if (!prev || date === dateOffset(prev, 1)) {
      run++;
    } else {
      run = 1;
    }
    if (run > best) best = run;
    prev = date;
  }

  return { current, best };
}
