# Backlog

Things known to be worth doing and not done. Not a wishlist — everything here
is either a decision already taken and not yet built, or a loose end left by
something that shipped.

Each entry says what the work is, why it is worth doing, and what is already
true that makes it cheap or expensive. Delete an entry when it ships; do not
leave it ticked.

---

## Browse the exercise library from the Exercise tab

**What.** A screen reached from the Exercise tab that lists the whole exercise
catalog to read rather than to pick from — the same 156 exercises, the same
rows the picker now draws, but as somewhere to go and look.

**Why.** The catalog and its demos currently only exist inside a modal you
open in order to answer a different question. You cannot browse the library
unless you are already mid-way through building a workout, which means the
demos — the drawings, the cues, the muscles — are only reachable by someone
who has already decided what they are doing. The obvious use is the opposite:
not sure what to train, open the list, read.

**What makes it cheap.** Nearly all of it exists.

- `EXERCISE_CATALOG` in `utils/exerciseList.ts` is the data, already grouped.
- `EXERCISE_DEMOS` in `data/exerciseDemos.ts` has a drawing, equipment,
  muscles and cues for 136 of them.
- `ExerciseDemoSheet` is the detail view, already built.
- The picker's rows — group card, thumbnail tile, "Barbell · Quads" subtitle,
  sticky headings — are the design this should match. They are currently
  inline in `ExercisePickerModal`; lifting them into a shared `ExerciseRow`
  is the first step, and the picker should then use it too rather than the
  two drifting apart.

**What is actually new.** The route and screen; a search field that filters
without the picker's "use as typed" row, which has no meaning here; and the
question of what tapping a row does. In the picker a tap selects. Here it
should open the demo, which means `ExerciseRow` needs to take its press
behaviour from the caller rather than assuming.

**Worth deciding first.** Whether this replaces the picker's own browsing or
sits beside it. Two lists of the same 156 things, reached differently, is the
kind of thing that looks fine when built and confusing a month later.

---

## Nothing in the demo feature has been seen on a device

Everything below rendered correctly in a mock and type-checks, and none of it
has been run on hardware. These are the specific things a mock cannot answer.

- **40pt thumbnails in the picker.** Line art at that size is exactly what
  reads fine in a render and poorly in a gym. If they do not hold up, the
  fallback is the row without a tile, not a bigger tile.
- **The demo loop.** 420ms a frame, 140ms crossfade, played 0,1,2,1. Tempo is
  a judgement call made without watching it.
- **`tintColor` on `Animated.Image`.** Types accept it; behaviour on both
  platforms is unverified.
- **153 rows mounting at once.** The thumbnails were cut to 128px to keep this
  under ~10 MB of decoded bitmap. Worth confirming the picker opens without a
  stall on an older phone, and moving to a `SectionList` if it does not.
- **The saved-workout swipe** (friction 1, open at a third of the tray,
  tap-to-close, one row open at a time).
- **The recovery alert** with the phone locked and Focus on.

---

## 1.0.7 has to be a native build

Not an OTA update. `app.json` declares the Time Sensitive notifications
entitlement, which only takes effect in a new binary — pushing 1.0.7 over the
air would ship the recovery alert without the thing that lets it through
Focus, which is the whole point of it.

---

## Rotate the USDA API key

`src/config.ts` falls back to a literal key when `EXPO_PUBLIC_USDA_API_KEY` is
unset. This repository is public, so that key is in the history and cannot be
removed by editing the file. The fallback should go, the env var should be
required, and the key itself should be reissued at
[fdc.nal.usda.gov](https://fdc.nal.usda.gov/api-key-signup.html).

The Supabase anon key in the same file is fine where it is — Row-Level
Security is what protects that data, and the key is designed to ship.

---

## Four iPad App Store slots still hold old screenshots

`marketing/appstore/appstore-ipad13-1.png` replaced one of five. The rest are
raw simulator grabs from an older build on an older palette. `ipad.js` renders
the slide the listing now uses; four more compositions are the work.

---

## There are no tests

Zero test files. The repository has never had any, so this is a decision to
make rather than a gap to fill — but there are four places where the arithmetic
is load-bearing and silently wrong-able:

- `utils/tdee.ts` — `rebalanceMacros` and `buildPlan`, where the calorie goal
  is derived from whole grams at 4/4/9.
- `utils/recovery.ts` — weekly bucketing by each week's own Sunday, which has
  to survive a DST boundary.
- `utils/trainingSplit.ts` — `consistencyStats`, which bounds completions to
  today.
- `utils/templateOrder.ts` — creation-order sort and the last-performed label.

---

## Twenty exercises have no demo

Mostly the Olympic and conditioning block: Clean, Power Clean, Clean and Jerk,
Snatch, Thruster, Turkish Get-up, Devil's Press, Wall Ball, Man Maker, Box
Jump, Sled Push, Sled Pull. Plus Svend Press, Pullover, Pendulum Squat,
Single-Leg Press, Machine Triceps Extension, Machine Crunch, Sit-up and
Jacobs Ladder.

The illustration set does not draw them. The photographs it replaced covered
most of the first group, and mixing one photograph into a set of line drawings
looks like a bug — so this stays open until either the set grows or somebody
draws twelve figures in the same hand.
