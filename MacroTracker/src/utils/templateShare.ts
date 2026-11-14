import * as Linking from 'expo-linking';
import { SetType, TemplateExercise, WorkoutTemplate } from '../types';
import { shareDictIndex, shareDictName } from './templateShareDict';

// Self-contained template sharing (no backend). A template is serialized into
// a compact payload and embedded in a deep link of the form
//   holymacro://import-template?d=<payload>
// (Linking.createURL adapts the scheme automatically — `exp://…/--/…` in Expo
// Go, the app scheme in a standalone build). Opening the link on a device that
// has the app decodes the payload and offers to add it to My Workouts.
//
// ## Why not JSON
//
// It was JSON, and a link for an eight-exercise push day ran to 1,100
// characters — about three quarters of the whole shared message. Almost none
// of that was the workout. A URL may only carry a small set of characters
// literally, and every `{ } " [ ] : ,` becomes three (`%7B`, `%22`…), so
// JSON's punctuation cost more than its content. Roughly 200 characters of
// actual workout arrived as 1,100.
//
// The format below is the same information with none of that: positions
// instead of keys, base 36 instead of decimal, and catalog exercises sent as
// their position in SHARE_DICT rather than by name. The same push day is 234
// characters. Compressing it as well reaches ~190, which is not worth a
// dependency — base64 inflates by a third on the way back out and eats most
// of what deflate saves on a payload this small.
//
//   3~<name>~<activity>~<exercise>~<exercise>…
//
//   exercise = [(]<ref>!<set>*<set>…       ( prefix = time-based
//   ref      = base-36 SHARE_DICT index, or 'name for anything else
//   set      = <weight>_<reps>_<type>[_<seconds>]
//   weight   = base-36 when whole, else a plain decimal (it has a dot in it)
//
// Separators are drawn from the nine characters encodeURIComponent leaves
// alone, and names escape the four of them they could otherwise collide with.

const IMPORT_PATH = 'import-template';

// Set types travel as small integers.
const TYPE_CODES: Record<SetType, number> = { normal: 0, warmup: 1, failure: 2, dropset: 3 };
const CODE_TYPES: SetType[] = ['normal', 'warmup', 'failure', 'dropset'];

// Structural characters, and the escape that lets a name contain them.
const ESC = '-';
const ESCAPES: Record<string, string> = { [ESC]: '--', '~': '-t', '!': '-b', '*': '-s' };
const UNESCAPES: Record<string, string> = { '-': ESC, t: '~', b: '!', s: '*' };

function escapeName(s: string): string {
  return s.replace(/[-~!*]/g, (ch) => ESCAPES[ch]);
}

function unescapeName(s: string): string {
  return s.replace(/-(.)/g, (whole, ch: string) => UNESCAPES[ch] ?? whole);
}

const b36 = (n: number): string => Math.round(n).toString(36);
const unb36 = (s: string): number => {
  const n = parseInt(s, 36);
  return Number.isFinite(n) ? n : 0;
};

/** Whole numbers go to base 36; a fraction stays decimal, which the dot marks. */
function encodeWeight(w: number): string {
  if (!w) return '0';
  return Number.isInteger(w) ? b36(w) : String(w);
}

function decodeWeight(s: string): number {
  if (s.includes('.')) {
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  }
  return unb36(s);
}

/** Build a deep link that encodes the entire template. */
export function encodeTemplateLink(t: WorkoutTemplate): string {
  const parts = ['3', escapeName(t.name), b36(t.activityType ?? 0)];

  for (const ex of t.exercises) {
    const i = shareDictIndex(ex.name);
    const ref = i >= 0 ? b36(i) : `'${escapeName(ex.name)}`;
    const head = (ex.mode === 'time' ? '(' : '') + ref;
    const sets = ex.sets
      .map((s) => {
        const base = [
          encodeWeight(s.weight || 0),
          b36(s.reps || 0),
          b36(TYPE_CODES[s.type ?? 'normal']),
        ];
        if (s.durationSeconds) base.push(b36(s.durationSeconds));
        return base.join('_');
      })
      .join('*');
    parts.push(`${head}!${sets}`);
  }

  // Built by hand rather than through createURL's queryParams, which
  // serializes with URLSearchParams. That form escapes everything outside
  // `* - . _`, so five of the nine separators this format relies on would
  // come back out three characters long each and most of the saving with
  // them.
  return `${Linking.createURL(IMPORT_PATH)}?d=${encodeURIComponent(parts.join('~'))}`;
}

/**
 * Pull the payload out of a link.
 *
 * Not Linking.parse, which decodes the query string and then calls
 * decodeURIComponent on the result a second time. A template named "100%
 * Legs" survives the first decode as a bare `%`, which the second throws on —
 * expo-linking swallows that, hands back no parameters at all, and the import
 * silently does nothing. One decode, by hand.
 */
function payloadFromUrl(url: string): string | null {
  const q = url.indexOf('?');
  if (q < 0) return null;
  for (const pair of url.slice(q + 1).split('&')) {
    const eq = pair.indexOf('=');
    if (eq < 0 || pair.slice(0, eq) !== 'd') continue;
    try {
      return decodeURIComponent(pair.slice(eq + 1));
    } catch {
      // Not our encoding, or truncated in transit.
      return null;
    }
  }
  return null;
}

function isImportUrl(url: string): boolean {
  // The path segment lands in hostname for the app scheme and in path for
  // exp:// dev URLs, so the whole thing is searched rather than either half.
  const beforeQuery = url.split('?')[0] ?? '';
  return beforeQuery.split(/[/:]/).includes(IMPORT_PATH);
}

/** v1 and v2 links: a JSON object with short keys. Still out in the world. */
interface WireTemplate {
  v: 1 | 2;
  n: string;
  a?: number;
  e: { n: string; m?: number; s: number[][] }[];
}

function decodeJsonPayload(raw: string, now: number): WorkoutTemplate | null {
  const wire = JSON.parse(raw) as WireTemplate;
  if (!wire || (wire.v !== 1 && wire.v !== 2) || !Array.isArray(wire.e)) return null;

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
}

function decodeCompactPayload(raw: string, now: number): WorkoutTemplate | null {
  const [, rawName, rawActivity, ...rawExercises] = raw.split('~');
  if (rawName === undefined) return null;

  const exercises: TemplateExercise[] = [];
  rawExercises.forEach((chunk, ei) => {
    const bang = chunk.indexOf('!');
    if (bang < 0) return;
    let head = chunk.slice(0, bang);

    const isTime = head.startsWith('(');
    if (isTime) head = head.slice(1);

    let name: string;
    if (head.startsWith("'")) {
      name = unescapeName(head.slice(1));
    } else {
      // A link may name an exercise this build has never heard of — it was
      // sent by a newer one. Better an exercise called "#211" that the user
      // can rename than a dropped row they never learn about.
      name = shareDictName(unb36(head)) ?? `#${head}`;
    }

    const body = chunk.slice(bang + 1);
    const sets = (body ? body.split('*') : []).map((s, si) => {
      const f = s.split('_');
      const type = CODE_TYPES[unb36(f[2] ?? '0')] ?? 'normal';
      return {
        id: `imp-${now}-${ei}-${si}`,
        weight: decodeWeight(f[0] ?? '0'),
        reps: unb36(f[1] ?? '0'),
        durationSeconds: f[3] != null ? unb36(f[3]) : undefined,
        type: type === 'normal' ? undefined : type,
      };
    });

    exercises.push({ id: `imp-${now}-${ei}`, name, mode: isTime ? 'time' : undefined, sets });
  });

  const activityType = unb36(rawActivity ?? '0');
  return {
    id: `tpl-${now}-${Math.random().toString(36).slice(2, 8)}`,
    name: unescapeName(rawName) || 'Shared workout',
    exercises,
    createdAt: now,
    activityType: activityType || undefined,
  };
}

/**
 * Parse an incoming deep link. Returns a ready-to-save WorkoutTemplate (with
 * fresh ids) if the URL is a valid template-import link, otherwise null.
 *
 * Both formats are read. A link is a message somebody sent; it does not stop
 * being one because the app moved on, and the JSON branch costs forty lines.
 */
export function decodeTemplateLink(url: string): WorkoutTemplate | null {
  try {
    if (!isImportUrl(url)) return null;
    const raw = payloadFromUrl(url);
    if (!raw) return null;

    const now = Date.now();
    if (raw.startsWith('{')) return decodeJsonPayload(raw, now);
    if (raw.startsWith('3~')) return decodeCompactPayload(raw, now);
    return null;
  } catch {
    return null;
  }
}
