#!/usr/bin/env node
/**
 * Asserts that a recovery finished on the wrist is written down exactly once.
 *
 *   node scripts/check-recovery-dedupe.js
 *
 * The bug this guards: a sauna begun on the watch while the phone sat in a
 * locker reached the phone twice under two different starts — the phone's,
 * from when the queued start command landed, and the watch's, from when the
 * wrist began — and the equality check meant to catch the second matched
 * neither. Both copies were saved at full length, so one fifteen-minute sauna
 * put thirty minutes on the week.
 *
 * No test runner and no bundler: this repository has neither, esbuild is not
 * a dependency, and a framework is a lot to carry for six lines of boolean.
 * So the predicate is restated here and then checked against its source, which
 * fails loudly if the two drift — including if someone puts the equality test
 * back.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Mirror of overlapsRecovery in src/utils/recovery.ts.
const overlaps = (s, label, startedAt, endsAt) =>
  s.activityType === 3000 && // HKWorkoutActivityTypeOther, what isRecoverySession reads
  s.name === label &&
  s.startedAt < endsAt &&
  (s.completedAt ?? s.startedAt) > startedAt;

// ---- the mirror still matches the source -----------------------------------
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'utils', 'recovery.ts'), 'utf8');
const body = src.slice(src.indexOf('export function overlapsRecovery'));
for (const frag of ['s.name === label', 's.startedAt < endsAt', '(s.completedAt ?? s.startedAt) > startedAt']) {
  assert.ok(body.includes(frag), `overlapsRecovery no longer contains "${frag}" — update this check`);
}
assert.ok(
  !/s\.startedAt === startedAt/.test(body),
  'overlapsRecovery is comparing starts for equality again — that is the bug this guards'
);

// ---- behaviour --------------------------------------------------------------
const MIN = 60 * 1000;
const session = (name, startedAt, mins) => ({
  id: `r-${startedAt}`, name, activityType: 3000,
  date: '2026-11-19', startedAt, completedAt: startedAt + mins * MIN, exercises: [],
});
const heldMs = (s) => Math.max(0, (s.completedAt ?? s.startedAt) - s.startedAt);

const T_WATCH = Date.parse('2026-11-19T18:00:00Z');
const T_PHONE = T_WATCH + 3 * MIN; // the start sat queued for three minutes
const HELD = 15;

let n = 0;
const ok = (what, cond) => { assert.ok(cond, what); n++; };

// The reported bug: saved under the phone's start, duplicate arrives under the
// watch's.
const saved = session('Sauna', T_PHONE, HELD);
ok("the duplicate under the watch's start is seen as the same session",
   overlaps(saved, 'Sauna', T_WATCH, T_WATCH + HELD * MIN));
ok('an equality test would have missed it — which is how it got through',
   saved.startedAt !== T_WATCH);

// Genuine separate sessions must still stand.
const first = session('Sauna', T_WATCH, 15);
const later = T_WATCH + 20 * MIN;
ok('a separate, later sauna is not swallowed',
   !overlaps(first, 'Sauna', later, later + 15 * MIN));
const abut = T_WATCH + 15 * MIN;
ok('one beginning exactly as the last ended is its own session',
   !overlaps(first, 'Sauna', abut, abut + 10 * MIN));
ok('a plunge never matches a sauna',
   !overlaps(first, 'Cold Plunge', T_WATCH, T_WATCH + 15 * MIN));
ok('a lift is never matched',
   !overlaps({ ...first, activityType: undefined }, 'Sauna', T_WATCH, T_WATCH + 15 * MIN));

// And the number the user actually sees.
ok('fifteen minutes in the sauna is fifteen minutes on the week',
   [saved].reduce((t, s) => t + heldMs(s), 0) === HELD * MIN);

console.log(`recovery dedupe: ${n} checks passed`);
