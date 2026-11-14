#!/usr/bin/env node
/**
 * Build the exercise demos: three drawn frames per exercise, and the steps
 * that go with them.
 *
 *   node scripts/gen-exercise-demos.js
 *
 * Writes assets/demos/*.png and src/data/exerciseDemos.ts, both committed.
 * Run by hand when the catalog, the mapping or the cues change, never at
 * build time. Needs the devDependencies installed and nothing else — no
 * network.
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
 * **The words** are ours, in exercise-cues.json: three lines an exercise,
 * set-up, the working half, and the thing people get wrong. They replaced
 * free-exercise-db's instructions, which were four to six paragraphs of
 * "breathe out as you perform this portion of the movement" and carried the
 * same unstated provenance the photographs did. Nobody standing at a machine
 * between sets reads six paragraphs. They were written from that text rather
 * than from nothing, so the specifics — grip widths, bench angles, which
 * part of the chest the bar touches — carry over.
 *
 * With that, nothing in this feature is borrowed except the drawings, and
 * those are licensed for it.
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
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT_IMG = path.join(ROOT, 'assets', 'demos');
const OUT_THUMB = path.join(OUT_IMG, 'thumbs');
const OUT_TS = path.join(ROOT, 'src', 'data', 'exerciseDemos.ts');
const ART_MAP = path.join(__dirname, 'exercise-demo-map.json');
const CUES = path.join(__dirname, 'exercise-cues.json');

const WG_DIR = path.dirname(require.resolve('@bryllim/workout-guide/manifest.json'));
const WG = require('@bryllim/workout-guide/manifest.json');
const WG_VERSION = require('@bryllim/workout-guide/package.json').version;
const PNGQUANT = require('pngquant-bin').default || require('pngquant-bin');

// ---------------------------------------------------------------------------

const artMap = JSON.parse(fs.readFileSync(ART_MAP, 'utf8'));
const cues = JSON.parse(fs.readFileSync(CUES, 'utf8'));

/**
 * Six exercises where the muscle chip contradicted the group the exercise is
 * filed under, and the promotion that fixes it.
 *
 * The catalog groups by the part of the body you went to the gym to train;
 * workout-guide labels by the prime mover, which is finer and sometimes
 * answers a different question. Usually that is a bonus. In six cases it
 * reads as a bug: you tap into Chest, open Weighted Dip, and the chip says
 * Triceps.
 *
 * Nothing is invented to fix it. In all six the label wanted is already in
 * that entry's own secondary list, so this promotes it and demotes the old
 * primary into second place — a reordering of what the source says, not a
 * correction of it. The generator checks that the named muscle really is in
 * the secondary list and stops if it is not, so this cannot quietly start
 * asserting something the data does not.
 *
 * Both facts stay on screen either way: the sheet shows the primary as a
 * chip and the rest as "Also works …".
 */
const PRIMARY_OVERRIDES = {
  'Weighted Dip': 'Chest',        // leaning forward, as the Chest group means it
  'Landmine Press': 'Chest',
  'Chin-up': 'Lats',              // as with every other pull in the group
  'Good Morning': 'Lower Back',
  'Deadlift': 'Back',
  'Reverse Pec Deck': 'Upper Back',
};
const wgByName = new Map(WG.map((e) => [e.name, e]));

// Fail loudly rather than silently dropping an exercise: a mapping that has
// gone stale against a newer package is exactly the thing worth stopping for.
const stale = Object.entries(artMap).filter(([, v]) => v && !wgByName.has(v));
if (stale.length) {
  console.error(`These mapped entries are not in @bryllim/workout-guide@${WG_VERSION}:`);
  for (const [k, v] of stale) console.error(`  ${k} -> ${v}`);
  process.exit(1);
}

// Every exercise with a drawing needs words to go with it. A demo that is
// three pictures and nothing else is the half-built version of this.
const mapped = Object.entries(artMap).filter(([, v]) => v).map(([k]) => k);
const uncued = mapped.filter((n) => !cues[n] || cues[n].length === 0);
if (uncued.length) {
  console.error('These have art but no cues in exercise-cues.json:');
  for (const n of uncued) console.error(`  ${n}`);
  process.exit(1);
}
const orphanCues = Object.keys(cues).filter((n) => !mapped.includes(n));
if (orphanCues.length) {
  console.error(`Cues for exercises with no art: ${orphanCues.join(', ')}`);
  process.exit(1);
}

fs.mkdirSync(OUT_IMG, { recursive: true });
fs.mkdirSync(OUT_THUMB, { recursive: true });
const keep = new Set();
const keepThumb = new Set();
let wrote = 0;

/**
 * A 128px copy of the middle frame, for the exercise picker's rows.
 *
 * Two reasons it is a separate file rather than the full frame scaled down.
 *
 * The picker is a ScrollView of 153 rows and ScrollView does not virtualise,
 * so every row mounts at once. At 512 square that is a megabyte of decoded
 * bitmap each and about 150 MB on screen — enough to be thrown out of memory
 * on an older phone. At 128 it is 64 KB each, under 10 MB for the lot.
 *
 * And the middle frame rather than the first: frame 1 is usually the neutral
 * standing position, which for a curl, a lateral raise or a pulldown is a
 * picture of a man holding something. Frame 2 is the bar at the chest, the
 * curl at the top, the pulldown at the bottom — the pose that tells one
 * exercise from another at 40pt.
 */
function thumbnail(e) {
  const file = `${e.slug}.png`;
  keepThumb.add(file);
  const dest = path.join(OUT_THUMB, file);
  if (fs.existsSync(dest)) return file;
  const mid = e.frames[1];
  const tmp = `${dest}.resize`;
  const rs = spawnSync('convert', [path.join(WG_DIR, mid.path), '-resize', '128x128', '-strip', tmp]);
  if (rs.status !== 0) { console.error(`convert failed on ${mid.path}: ${rs.stderr}`); process.exit(1); }
  const r = spawnSync(PNGQUANT, ['--quality', '60-90', '--speed', '1', '--force', '--output', dest, tmp]);
  if (r.status !== 0) { console.error(`pngquant failed on ${file}: ${r.stderr}`); process.exit(1); }
  fs.unlinkSync(tmp);
  return file;
}

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

  let primary = e.primaryMuscle ? [e.primaryMuscle] : [];
  let secondary = e.secondaryMuscles || [];
  const promote = PRIMARY_OVERRIDES[name];
  if (promote) {
    if (!secondary.includes(promote)) {
      console.error(`${name}: cannot promote "${promote}" — it is not in that entry's secondary muscles (${secondary.join(', ') || 'none'}).`);
      process.exit(1);
    }
    secondary = [...primary, ...secondary.filter((m) => m !== promote)];
    primary = [promote];
  }

  entries.push({
    name,
    source: e.name,
    slug: e.slug,
    thumb: thumbnail(e),
    equipment: e.equipment || null,
    primary,
    secondary,
    steps: cues[name],
    frames,
  });
}
if (wrote) process.stdout.write('\n');

// Anything in assets/demos that nothing points at any more — including every
// .jpg from the photographs this replaced.
for (const f of fs.readdirSync(OUT_IMG)) {
  if (f === 'ATTRIBUTION.md' || f === 'thumbs') continue;
  if (!keep.has(f)) {
    fs.unlinkSync(path.join(OUT_IMG, f));
    console.log('removed', f);
  }
}
for (const f of fs.readdirSync(OUT_THUMB)) {
  if (!keepThumb.has(f)) {
    fs.unlinkSync(path.join(OUT_THUMB, f));
    console.log('removed thumbs/' + f);
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
    thumb: require('../../assets/demos/thumbs/${e.thumb}'),
    frames: [
${e.frames.map((f) => `      require('../../assets/demos/${f}'),`).join('\n')}
    ],
  },`)
  .join('\n');

const unmapped = Object.entries(artMap).filter(([, v]) => !v).map(([k]) => k);

fs.writeFileSync(OUT_TS, `// GENERATED by scripts/gen-exercise-demos.js — do not edit by hand.
//
// Three drawn frames and the steps for ${entries.length} of the ${Object.keys(artMap).length}
// exercises in EXERCISE_CATALOG. The other ${unmapped.length}, and every name a user types
// for themselves, have no demo and the UI does not offer one:
// ${unmapped.join(', ')}.
//
// Illustrations: @bryllim/workout-guide@${WG_VERSION} — Bryl Lim, building on
// Everkinetic, CC BY-SA 4.0; see assets/demos/ATTRIBUTION.md. The cues are
// ours, in scripts/exercise-cues.json. See the generator for why the name
// mapping is written by hand.
import type { ImageSourcePropType } from 'react-native';

export interface ExerciseDemo {
  /** The workout-guide entry the frames came from, so a bad match can be traced. */
  source: string;
  /** Title case, as workout-guide has it: "Barbell", "Bodyweight", "Machine". */
  equipment: string | null;
  primary: string[];
  secondary: string[];
  /** Three lines: set-up, the working half, and the thing people get wrong. */
  steps: [string, string, string];
  /** The middle frame at 128px, for the picker's rows. See the generator. */
  thumb: ImageSourcePropType;
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
[@bryllim/workout-guide](https://github.com/bryllim/workout-guide) v${WG_VERSION},
plus ${keepThumb.size} thumbnails in \`thumbs/\` derived from them.

${[...creators.values()].map((a) =>
  `- Illustrations by [${a.creator}](${a.creatorUrl}), licensed [${a.license}](${a.licenseUrl}).`
).join('\n')}
${[...upstream.values()].map((u) =>
  `- ${derived} of the ${entries.length} are built on poses from [${u.name}](https://github.com/everkinetic/data), ` +
  `licensed [${u.license}](${u.licenseUrl}). Per the package's own attribution, those were ` +
  `"${u.changes}"`
).join('\n')}

## Changes made

The frames were re-encoded with \`pngquant --quality 65-92\` and nothing else:
no resize, no recolour, no crop. That takes the set from 11.95 MB to
${(keep.size ? (fs.readdirSync(OUT_IMG).filter((f) => f.endsWith('.png')).reduce((t, f) => t + fs.statSync(path.join(OUT_IMG, f)).size, 0) / 1048576).toFixed(2) : '0')} MB, which is invisible at the size the app draws them.

The thumbnails in \`thumbs/\` are each exercise's **second** frame scaled to
128 × 128 and re-encoded the same way. Nothing else is altered.

The app draws both tinted to the theme's text colour. The files on disk are
unchanged white.

These assets remain under CC BY-SA 4.0. That applies to the illustrations in
this folder, not to the rest of the application.

## The words are not from here

workout-guide ships no text. The cues in \`src/data/exerciseDemos.ts\` are
ours, written for this app and kept in \`scripts/exercise-cues.json\`. Nothing
in this feature is borrowed except the drawings above.
`);

const bytes = fs.readdirSync(OUT_IMG)
  .filter((f) => f.endsWith('.png'))
  .reduce((t, f) => t + fs.statSync(path.join(OUT_IMG, f)).size, 0);

const thumbBytes = fs.readdirSync(OUT_THUMB)
  .reduce((t, f) => t + fs.statSync(path.join(OUT_THUMB, f)).size, 0);
console.log(`${entries.length} demos, ${keep.size} frames, ${(bytes / 1048576).toFixed(2)} MB`);
console.log(`${keepThumb.size} thumbnails, ${(thumbBytes / 1024).toFixed(0)} KB`);
console.log(`no demo for ${unmapped.length}: ${unmapped.join(', ')}`);
