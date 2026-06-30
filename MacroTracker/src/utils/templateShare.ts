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

// Wire shape: versioned, with short keys. Each set is [weight, reps, typeCode]
// or, for time-based exercises, [weight, reps, typeCode, durationSeconds]. An
// exercise carries m:1 when it's time-based (omitted for the default rep mode).
// v2 added m + the optional 4th set element; v1 links still decode (no time).
interface WireTemplate {
  v: 1 | 2;
  n: string;
  a?: number; // workout activity type (HKWorkoutActivityType raw value)
  e: { n: string; m?: number; s: number[][] }[];
}

/** Build a deep link that encodes the entire template. */
export function encodeTemplateLink(t: WorkoutTemplate): string {
  const wire: WireTemplate = {
    v: 2,
    n: t.name,
    ...(t.activityType ? { a: t.activityType } : {}),
    e: t.exercises.map((ex) => ({
      n: ex.name,
      ...(ex.mode === 'time' ? { m: 1 } : {}),
      s: ex.sets.map((s) => {
        const base = [s.weight || 0, s.reps || 0, TYPE_CODES[s.type ?? 'normal']];
        return s.durationSeconds ? [...base, s.durationSeconds] : base;
      }),
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
    if (!wire || (wire.v !== 1 && wire.v !== 2) || !Array.isArray(wire.e)) return null;

    const now = Date.now();
    const exercises: TemplateExercise[] = wire.e.map((ex, ei) => ({
      id: `imp-${now}-${ei}`,
      name: String(ex.n ?? 'Exercise'),
      mode: Number(ex.m) === 1 ? 'time' : undefined,
      sets: (Array.isArray(ex.s) ? ex.s : []).map((s, si) => {
        const type = CODE_TYPES[Number(s?.[2])] ?? 'normal';
        const dur = s?.[3];
        return {
          id: `imp-${now}-${ei}-${si}`,
          weight: Number(s?.[0]) || 0,
          reps: Number(s?.[1]) || 0,
          durationSeconds: dur != null ? Number(dur) || 0 : undefined,
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
      activityType: typeof wire.a === 'number' ? wire.a : undefined,
    };
  } catch {
    return null;
  }
}
