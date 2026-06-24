import * as Linking from 'expo-linking';
import { SetType, TemplateExercise, WorkoutTemplate } from '../types';

// Self-contained template sharing (no backend). A template is serialized into
// a compact JSON payload and embedded in a deep link of the form
//   macrotracker://import-template?d=<json>
// (Linking.createURL adapts the scheme automatically — `exp://…/--/…` in Expo
// Go, the app scheme in a standalone build). Opening the link on a device that
// has the app decodes the payload and offers to add it to My Workouts.

const IMPORT_PATH = 'import-template';

// Set types are sent as small integer codes to keep the URL short.
const TYPE_CODES: Record<SetType, number> = { normal: 0, warmup: 1, failure: 2, dropset: 3 };
const CODE_TYPES: SetType[] = ['normal', 'warmup', 'failure', 'dropset'];

// Wire shape: versioned, with short keys. Each set is [weight, reps, typeCode].
interface WireTemplate {
  v: 1;
  n: string;
  e: { n: string; s: [number, number, number][] }[];
}

/** Build a deep link that encodes the entire template. */
export function encodeTemplateLink(t: WorkoutTemplate): string {
  const wire: WireTemplate = {
    v: 1,
    n: t.name,
    e: t.exercises.map((ex) => ({
      n: ex.name,
      s: ex.sets.map((s) => [s.weight || 0, s.reps || 0, TYPE_CODES[s.type ?? 'normal']]),
    })),
  };
  return Linking.createURL(IMPORT_PATH, { queryParams: { d: JSON.stringify(wire) } });
}

/**
 * Parse an incoming deep link. Returns a ready-to-save WorkoutTemplate (with
 * fresh ids) if the URL is a valid template-import link, otherwise null.
 */
export function decodeTemplateLink(url: string): WorkoutTemplate | null {
  try {
    const { hostname, path, queryParams } = Linking.parse(url);
    // Depending on the scheme the path segment lands in hostname (app scheme)
    // or path (exp:// dev URLs), so check both.
    const segments = [hostname, ...(path ? path.split('/') : [])].filter(Boolean);
    if (!segments.includes(IMPORT_PATH)) return null;

    const raw = queryParams?.d;
    if (typeof raw !== 'string') return null;

    const wire = JSON.parse(raw) as WireTemplate;
    if (!wire || wire.v !== 1 || !Array.isArray(wire.e)) return null;

    const now = Date.now();
    const exercises: TemplateExercise[] = wire.e.map((ex, ei) => ({
      id: `imp-${now}-${ei}`,
      name: String(ex.n ?? 'Exercise'),
      sets: (Array.isArray(ex.s) ? ex.s : []).map((s, si) => {
        const type = CODE_TYPES[Number(s?.[2])] ?? 'normal';
        return {
          id: `imp-${now}-${ei}-${si}`,
          weight: Number(s?.[0]) || 0,
          reps: Number(s?.[1]) || 0,
          // Keep the app convention: undefined === normal.
          type: type === 'normal' ? undefined : type,
        };
      }),
    }));

    return {
      id: `tpl-${now}-${Math.random().toString(36).slice(2, 8)}`,
      name: String(wire.n ?? 'Shared workout'),
      exercises,
      createdAt: now,
    };
  } catch {
    return null;
  }
}
