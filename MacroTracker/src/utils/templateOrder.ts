import { displayDate } from './date';
import type { WorkoutSession, WorkoutTemplate } from '../types';

export interface TemplateRow {
  template: WorkoutTemplate;
  /** Exercises in the template — the numeral on the row's tile. */
  count: number;
  /** "Last Tuesday", or null if it has never been performed. */
  lastLabel: string | null;
}

/**
 * The saved workouts, in the order they were created, with the date each was
 * last performed.
 *
 * Creation order, not recency of use. Recency seems like the obvious ranking
 * and is the wrong one here: anyone running a Push / Pull / Legs rotation
 * finishes a session and the thing they just did climbs to the top, which is
 * precisely the one they will not want next. Creation order does not move.
 * It is also the order the user put them in, implicitly, by making them.
 *
 * The last-performed date is still worth showing — on a rotation it is the
 * fact that tells you where you are in it — it just has no business deciding
 * the sort.
 */
export function templateRows(
  templates: WorkoutTemplate[],
  history: WorkoutSession[]
): TemplateRow[] {
  // One pass over history for the newest completed session per template,
  // rather than scanning the whole log once per template.
  const lastByTemplate = new Map<string, string>();
  for (const s of history) {
    if (!s.templateId || s.completedAt == null) continue;
    const seen = lastByTemplate.get(s.templateId);
    if (!seen || s.date > seen) lastByTemplate.set(s.templateId, s.date);
  }

  return [...templates]
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((template) => {
      const date = lastByTemplate.get(template.id);
      return {
        template,
        count: template.exercises.length,
        lastLabel: date ? displayDate(date) : null,
      };
    });
}

/** The row's second line: when it was last done, or what is in it. */
export function templateSubtitle(row: TemplateRow): string {
  if (row.lastLabel) return row.lastLabel;
  return `${row.count} exercise${row.count === 1 ? '' : 's'} · never done`;
}
