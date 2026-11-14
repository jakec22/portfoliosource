#!/usr/bin/env node
/**
 * Build the exercise demos: three drawn frames per exercise, and the steps
 * that go with them.
 *
 *   node scripts/gen-exercise-demos.js
 *
 * Writes assets/demos/*.png and src/data/exerciseDemos.ts, both committed.
 * Run by hand when the catalog or either mapping changes, never at build
 * time. Needs the devDependencies installed; the step text also needs
 * network, and is skipped with --no-steps.
 *
 * ## Two sources, deliberately
 *
 * **The pictures** are @bryllim/workout-guide: 302 exercises, three frames
 * each, white line art on transparency, by Bryl Lim building on Everkinetic.
 * CC BY-SA 4.0, which says in as many words that you may use them
 * commercially given credit, a link to the licence, and a note of any
 * changes. The package also carries per-frame attribution, which is what the
 * credit in the sheet is built from rather than a string typed here.
 *
 * These replaced photographs from free-exercise-db. That set had no stated
 * provenance for its media at all, and it looked like what it was: a man in
 * a red-walled gym, which is nobody's app. Line art on transparency sits on
 * the card in either theme pack and can be tinted; it is also three frames
 * rather than two, so the loop reads as a repetition instead of a before and
 * after.
 *
 * **The step text** is still free-exercise-db, mapped separately in
 * exercise-steps-map.json, because workout-guide ships no text of its own.
 * Worth being plain about: that text reads like bodybuilding.com's exercise
 * database and carries the same unstated provenance the photographs did.
 * It is kept because swapping the art was the change asked for and dropping
 * the words was not, and it is mapped separately so that replacing it is one
 * file and one field.
 *
 * ## The mappings are by hand, and have to be
 *
 * Both datasets name exercises the way an encyclopedia does; the catalog
 * names them the way a gym does. 101 of our 156 matched workout-guide
 * outright. Fuzzy matching the rest is worse than useless: "Barbell Bench
 * Press" scores highest against "Barbell Guillotine Bench Press", a
 * different exercise with a different bar path, and a demo that confidently
 * shows the wrong movement is worse than no demo.
 *
 * The rule used for the rest: the same movement with a different implement
 * or bench angle is an acceptable match, a different movement is not. So
 * Incline Chest Press takes the machine chest press (right machine, wrong
 * seat angle) rather than a barbell incline bench (right angle, wrong
 * equipment) — because the equipment chip beside it has to stay true. Twenty
 * exercises map to null, mostly the Olympic and conditioning block the set
 * does not draw. Those, and every name typed by hand, show no demo
 * affordance at all.
 *
 * ## Why the pictures are re-encoded
 *
 * Unmodified the set is 11.95 MB. pngquant takes it to 6.78 MB, and at the
 * size the sheet draws them the difference is not visible — 19 alpha levels
 * against 256, on line art, at 271pt. That is a change to the work, so it is
 * stated in ATTRIBUTION.md as the licence asks. Nothing else is touched: no
 * resize, no recolour, no crop.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT_IMG = path.join(ROOT, 'assets', 'demos');
const OUT_TS = path.join(ROOT, 'src', 'data', 'exerciseDemos.ts');
const ART_MAP = path.join(__dirname, 'exercise-demo-map.json');
const STEP_MAP = path.join(__dirname, 'exercise-steps-map.json');

const WG_DIR = path.dirname(require.resolve('@bryllim/workout-guide/manifest.json'));
const WG = require('@bryllim/workout-guide/manifest.json');
const WG_VERSION = require('@bryllim/workout-guide/package.json').version;
const PNGQUANT = require('pngquant-bin').default || require('pngquant-bin');

const FEDB_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
const skipSteps = process.argv.includes('--no-steps');

// ---------------------------------------------------------------------------

const artMap = JSON.parse(fs.readFileSync(ART_MAP, 'utf8'));
const stepMap = JSON.parse(fs.readFileSync(STEP_MAP, 'utf8'));
const wgByName = new Map(WG.map((e) => [e.name, e]));

// Fail loudly rather than silently dropping an exercise: a mapping that has
// gone stale against a newer package is exactly the thing worth stopping for.
const stale = Object.entries(artMap).filter(([, v]) => v && !wgByName.has(v));
if (stale.length) {
  console.error(`These mapped entries are not in @bryllim/workout-guide@${WG_VERSION}:`);
  for (const [k, v] of stale) console.error(`  ${k} -> ${v}`);
  process.exit(1);
}

// Step text, keyed by catalog name. Absent entirely with --no-steps, which
// keeps the pictures reproducible without the network.
const steps = new Map();
if (!skipSteps) {
  console.log('fetching step text…');
  const fedb = JSON.parse(execFileSync('curl', ['-sS', '--max-time', '60', FEDB_URL], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  }));
  const byName = new Map(fedb.map((e) => [e.name, e]));
  for (const [name, source] of Object.entries(stepMap)) {
    if (!source) continue;
    const e = byName.get(source);
    if (!e) { console.error(`step source gone: ${name} -> ${source}`); process.exit(1); }
    const text = (e.instructions || []).map((s) => s.trim()).filter(Boolean);
    if (text.length) steps.set(name, { source, text });
  }
}

fs.mkdirSync(OUT_IMG, { recursive: true });
const keep = new Set();
let wrote = 0;

const entries = [];
for (const [name, source] of Object.entries(artMap)) {
  if (!source) continue;
  const e = wgByName.get(source);
  if (e.frames.length !== 3) {
    console.error(`${source} has ${e.frames.length} frames; expected 3`);
    process.exit(1);
  }

  const frames = e.frames.map((f) => {
    const file = `${e.slug}-${f.index}.png`;
    const dest = path.join(OUT_IMG, file);
    keep.add(file);
    if (!fs.existsSync(dest)) {
      const r = spawnSync(PNGQUANT, [
        '--quality', '65-92', '--speed', '1', '--force', '--output', dest,
        path.join(WG_DIR, f.path),
      ]);
      if (r.status !== 0) {
        console.error(`pngquant failed on ${f.path}: ${r.stderr}`);
        process.exit(1);
      }
      wrote++;
      process.stdout.write('.');
    }
    return file;
  });

  const st = steps.get(name);
  entries.push({
    name,
    source: e.name,
    slug: e.slug,
    equipment: e.equipment || null,
    primary: e.primaryMuscle ? [e.primaryMuscle] : [],
    secondary: e.secondaryMuscles || [],
    steps: st ? st.text : [],
    stepSource: st ? st.source : null,
    frames,
  });
}
if (wrote) process.stdout.write('\n');

// Anything in assets/demos that nothing points at any more — including every
// .jpg from the photographs this replaced.
for (const f of fs.readdirSync(OUT_IMG)) {
  if (f === 'ATTRIBUTION.md') continue;
  if (!keep.has(f)) {
    fs.unlinkSync(path.join(OUT_IMG, f));
    console.log('removed', f);
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
${e.frames.map((f) => `      require('../../assets/demos/${f}'),`).join('\n')}
    ],
  },`)
  .join('\n');

const unmapped = Object.entries(artMap).filter(([, v]) => !v).map(([k]) => k);
const noSteps = entries.filter((e) => e.steps.length === 0).map((e) => e.name);

fs.writeFileSync(OUT_TS, `// GENERATED by scripts/gen-exercise-demos.js — do not edit by hand.
//
// Three drawn frames and the steps for ${entries.length} of the ${Object.keys(artMap).length}
// exercises in EXERCISE_CATALOG. The other ${unmapped.length}, and every name a user types
// for themselves, have no demo and the UI does not offer one:
// ${unmapped.join(', ')}.
//
// Illustrations: @bryllim/workout-guide@${WG_VERSION} — Bryl Lim, building on
// Everkinetic, CC BY-SA 4.0. Step text: free-exercise-db. See
// assets/demos/ATTRIBUTION.md and the generator for both, and for why the
// name mappings are written by hand.
import type { ImageSourcePropType } from 'react-native';

export interface ExerciseDemo {
  /** The workout-guide entry the frames came from, so a bad match can be traced. */
  source: string;
  /** Title case, as workout-guide has it: "Barbell", "Bodyweight", "Machine". */
  equipment: string | null;
  primary: string[];
  secondary: string[];
  /** May be empty — ${noSteps.length} of these have art but no text. */
  steps: string[];
  /**
   * Three positions through the movement, in the order the set numbers them.
   *
   * Not reliably start, middle and end: a bench press is lockout, middle,
   * chest, while a lateral raise is down, up, down — a whole repetition.
   * The set documents no semantics, so none are claimed here. Playing them
   * out and back reads correctly either way.
   */
  frames: [ImageSourcePropType, ImageSourcePropType, ImageSourcePropType];
}

export const EXERCISE_DEMOS: Record<string, ExerciseDemo> = {
${body}
};

/** The demo for an exercise, or null for a custom name or an unmapped one. */
export function exerciseDemo(name: string): ExerciseDemo | null {
  return EXERCISE_DEMOS[name] ?? null;
}
`);

// Attribution, as the licence asks: credit, a link to it, and the changes.
// Generated with the rest so it cannot drift from what actually shipped.
// Keyed separately: only some entries carry an upstream `source`, because
// not every pose derives from Everkinetic — Bryl Lim drew the rest. A single
// map keyed on creator silently kept whichever one was written last, which
// dropped the upstream credit the licence actually turns on.
const creators = new Map();
const upstream = new Map();
let derived = 0;
for (const e of entries) {
  const a = wgByName.get(e.source).attribution;
  if (!a) continue;
  creators.set(a.creator, a);
  if (a.source) { upstream.set(a.source.name, a.source); derived++; }
}
fs.writeFileSync(path.join(OUT_IMG, 'ATTRIBUTION.md'), `<!-- GENERATED by scripts/gen-exercise-demos.js — do not edit by hand. -->
# Exercise demo illustrations

The ${keep.size} PNGs in this folder are ${entries.length} exercises × 3 frames from
[@bryllim/workout-guide](https://github.com/bryllim/workout-guide) v${WG_VERSION}.

${[...creators.values()].map((a) =>
  `- Illustrations by [${a.creator}](${a.creatorUrl}), licensed [${a.license}](${a.licenseUrl}).`
).join('\n')}
${[...upstream.values()].map((u) =>
  `- ${derived} of the ${entries.length} are built on poses from [${u.name}](https://github.com/everkinetic/data), ` +
  `licensed [${u.license}](${u.licenseUrl}). Per the package's own attribution, those were ` +
  `"${u.changes}"`
).join('\n')}

## Changes made

Each file was re-encoded with \`pngquant --quality 65-92\` and nothing else:
no resize, no recolour, no crop. That takes the set from 11.95 MB to
${(keep.size ? (fs.readdirSync(OUT_IMG).filter((f) => f.endsWith('.png')).reduce((t, f) => t + fs.statSync(path.join(OUT_IMG, f)).size, 0) / 1048576).toFixed(2) : '0')} MB, which is invisible at the size the app draws them.

These assets remain under CC BY-SA 4.0. That applies to the illustrations in
this folder, not to the rest of the application.

## Step text

The written steps in \`src/data/exerciseDemos.ts\` are **not** from
workout-guide, which ships no text. They come from
[free-exercise-db](https://github.com/yuhonas/free-exercise-db), whose
repository carries an Unlicense badge but says nothing about the provenance
of its content.
`);

const bytes = fs.readdirSync(OUT_IMG)
  .filter((f) => f.endsWith('.png'))
  .reduce((t, f) => t + fs.statSync(path.join(OUT_IMG, f)).size, 0);

console.log(`${entries.length} demos, ${keep.size} frames, ${(bytes / 1048576).toFixed(2)} MB`);
console.log(`no demo for ${unmapped.length}: ${unmapped.join(', ')}`);
if (noSteps.length) console.log(`art but no steps (${noSteps.length}): ${noSteps.join(', ')}`);
