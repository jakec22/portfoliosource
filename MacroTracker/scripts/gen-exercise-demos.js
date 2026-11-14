#!/usr/bin/env node
/**
 * Build the exercise demos: two photographs per exercise and the steps that
 * go with them.
 *
 *   node scripts/gen-exercise-demos.js
 *
 * Writes assets/demos/*.jpg and src/data/exerciseDemos.ts, both committed.
 * Needs network and ImageMagick, and is run by hand when the catalog or the
 * mapping changes — never at build time.
 *
 * ## Where the pictures come from
 *
 * yuhonas/free-exercise-db, which carries an Unlicense badge on the
 * repository. Worth knowing before leaning on that: neither its README nor
 * the upstream it credits (wrkout/exercises.json) says anything about where
 * the photographs came from or who shot them, and the step text reads like
 * bodybuilding.com's exercise database. The badge covers the repository; it
 * is not a provenance statement about the media inside it. This was a
 * deliberate call, not an oversight. If a cleaner set is ever licensed, the
 * only things that change are this file and the contents of assets/demos —
 * every call site goes through EXERCISE_DEMOS and does not care.
 *
 * ## The mapping is by hand, and has to be
 *
 * The dataset names exercises the way an encyclopedia does; the catalog names
 * them the way a gym does. Only 42 of our 156 names matched it outright.
 * Fuzzy matching on the rest is worse than useless here — "Barbell Bench
 * Press" scores highest against "Barbell Guillotine Bench Press", which is a
 * different exercise with a different bar path, and a demo that confidently
 * shows the wrong movement is worse than no demo at all. So the remaining
 * matches were made by reading, and live in scripts/exercise-demo-map.json.
 *
 * Sixteen are mapped to null, because the dataset has nothing honest for
 * them: machines it predates (pendulum squat, belt squat), things nobody
 * needs a photograph of (running, swimming), and movements it simply lacks
 * (burpee, wall ball). A null is a real answer. The UI just doesn't offer a
 * demo for those, which is the behaviour custom exercise names get anyway.
 *
 * ## Why two frames
 *
 * Every entry has exactly two: the start of the movement and the end. Shown
 * alternating, they read as the movement itself. That is the whole demo —
 * there is no video here and nothing to buffer, which is the point, since
 * this gets opened in a basement gym between sets.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT_IMG = path.join(ROOT, 'assets', 'demos');
const OUT_TS = path.join(ROOT, 'src', 'data', 'exerciseDemos.ts');
const MAP = path.join(__dirname, 'exercise-demo-map.json');
const DB_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
const IMG_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';

// 600px wide at quality 70. The sheet shows a frame about 340pt across, so
// this is comfortably sharp on a 3x screen and costs ~29KB a picture; the
// originals are 850px and 66KB, which is 18MB across the set for detail
// nobody can see at this size.
const WIDTH = 600;
const QUALITY = 70;

function sh(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`${cmd} failed: ${r.stderr || r.stdout}`);
  return r.stdout;
}

// ---------------------------------------------------------------------------

const map = JSON.parse(fs.readFileSync(MAP, 'utf8'));

console.log('fetching dataset…');
const db = JSON.parse(execFileSync('curl', ['-sS', '--max-time', '60', DB_URL], {
  encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
}));
const byName = new Map(db.map((e) => [e.name, e]));

// Fail loudly rather than silently dropping an exercise: a mapping that has
// gone stale against a newer dataset is exactly the thing worth stopping for.
const missing = Object.entries(map).filter(([, v]) => v && !byName.has(v));
if (missing.length) {
  console.error('These mapped entries are no longer in the dataset:');
  for (const [k, v] of missing) console.error(`  ${k} -> ${v}`);
  process.exit(1);
}

fs.mkdirSync(OUT_IMG, { recursive: true });
const keep = new Set();

const entries = [];
for (const [name, source] of Object.entries(map)) {
  if (!source) continue;
  const e = byName.get(source);
  if (e.images.length < 2) {
    console.error(`${source} has ${e.images.length} image(s); expected 2`);
    process.exit(1);
  }

  const frames = e.images.slice(0, 2).map((rel, i) => {
    const file = `${rel.split('/')[0]}-${i}.jpg`;
    const dest = path.join(OUT_IMG, file);
    keep.add(file);
    if (!fs.existsSync(dest)) {
      const tmp = `${dest}.download`;
      sh('curl', ['-sS', '--fail', '--max-time', '30', '-o', tmp, IMG_BASE + encodeURI(rel)]);
      // Re-encode rather than ship what was downloaded: it is both the resize
      // and the thing that strips whatever metadata came with the file.
      sh('convert', [tmp, '-resize', `${WIDTH}x${WIDTH}>`, '-strip',
                     '-interlace', 'Plane', '-sampling-factor', '4:2:0',
                     '-quality', String(QUALITY), dest]);
      fs.unlinkSync(tmp);
      process.stdout.write('.');
    }
    return file;
  });

  entries.push({
    name,
    source,
    equipment: e.equipment || null,
    primary: e.primaryMuscles || [],
    secondary: e.secondaryMuscles || [],
    steps: (e.instructions || []).map((s) => s.trim()).filter(Boolean),
    frames,
  });
}
process.stdout.write('\n');

// Anything in assets/demos that nothing points at any more.
for (const f of fs.readdirSync(OUT_IMG)) {
  if (f.endsWith('.jpg') && !keep.has(f)) {
    fs.unlinkSync(path.join(OUT_IMG, f));
    console.log('removed stale', f);
  }
}

// ---------------------------------------------------------------------------

const q = (s) => JSON.stringify(s);
const body = entries
  .map((e) => `  ${q(e.name)}: {
    source: ${q(e.source)},
    equipment: ${e.equipment ? q(e.equipment) : 'null'},
    primary: [${e.primary.map(q).join(', ')}],
    secondary: [${e.secondary.map(q).join(', ')}],
    steps: [
${e.steps.map((s) => `      ${q(s)},`).join('\n')}
    ],
    frames: [
      require('../../assets/demos/${e.frames[0]}'),
      require('../../assets/demos/${e.frames[1]}'),
    ],
  },`)
  .join('\n');

const unmapped = Object.entries(map).filter(([, v]) => !v).map(([k]) => k);

fs.writeFileSync(OUT_TS, `// GENERATED by scripts/gen-exercise-demos.js — do not edit by hand.
//
// Two photographs and the steps for ${entries.length} of the ${Object.keys(map).length}
// exercises in EXERCISE_CATALOG. The rest, and every name a user types for
// themselves, have no demo and the UI simply does not offer one:
// ${unmapped.join(', ')}.
//
// See the script for where the pictures come from and why the mapping from
// catalog names to dataset entries is written by hand.
import type { ImageSourcePropType } from 'react-native';

export interface ExerciseDemo {
  /** The free-exercise-db entry this came from, so a bad match can be traced. */
  source: string;
  equipment: string | null;
  /** Lowercase, as the dataset has them: "quadriceps", "middle back". */
  primary: string[];
  secondary: string[];
  /** May be empty — a few entries in the dataset carry no text at all. */
  steps: string[];
  /** Start of the movement, then the end of it. */
  frames: [ImageSourcePropType, ImageSourcePropType];
}

export const EXERCISE_DEMOS: Record<string, ExerciseDemo> = {
${body}
};

/** The demo for an exercise, or null for a custom name or an unmapped one. */
export function exerciseDemo(name: string): ExerciseDemo | null {
  return EXERCISE_DEMOS[name] ?? null;
}
`);

const bytes = fs.readdirSync(OUT_IMG)
  .filter((f) => f.endsWith('.jpg'))
  .reduce((t, f) => t + fs.statSync(path.join(OUT_IMG, f)).size, 0);

console.log(`${entries.length} demos, ${keep.size} images, ${(bytes / 1024 / 1024).toFixed(1)} MB`);
console.log(`no demo for ${unmapped.length}: ${unmapped.join(', ')}`);
