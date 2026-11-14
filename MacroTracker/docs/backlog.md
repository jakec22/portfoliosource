# Backlog

Things known to be worth doing and not done. Not a wishlist — everything here
is either a decision already taken and not yet built, or a loose end left by
something that shipped.

Each entry says what the work is, why it is worth doing, and what is already
true that makes it cheap or expensive. Delete an entry when it ships; do not
leave it ticked.

---

## Nothing in the demo feature has been seen on a device

Everything below rendered correctly in a mock and type-checks, and none of it
has been run on hardware. These are the specific things a mock cannot answer.

- **40pt thumbnails**, in the picker and the library both. Line art at that
  size is exactly what reads fine in a render and poorly in a gym. If they do
  not hold up, the fallback is the row without a tile, not a bigger tile.
- **The demo loop.** 420ms a frame, 140ms crossfade, played 0,1,2,1. Tempo is
  a judgment call made without watching it.
- **`tintColor` on `Animated.Image`.** Types accept it; behavior on both
  platforms is unverified.
- **153 rows mounting at once**, now in two screens. The thumbnails were cut
  to 128px to keep this under ~10 MB of decoded bitmap. Worth confirming both
  the picker and the library open without a stall on an older phone, and
  moving to a `SectionList` if either does not.
- **The saved-workout swipe** (friction 1, open at a third of the tray,
  tap-to-close, one row open at a time).
- **The recovery alert** with the phone locked and Focus on.

---

## Nobody has read a generated program yet

`design-workout` is deployed and live. What is untested is the only part of
it that cannot be tested from here: whether Flash writes a *sensible* week.
The enum guarantees every exercise is real, performable and illustrated. It
guarantees nothing about whether the three days are a coherent split, whether
the volume suits the session length, or whether a beginner can follow the
note.

So: generate programs against several different sets of answers — 2 days
bodyweight, 5 days gym, 30 minutes against 60 — and read them as a coach
would. The prompt is the thing to adjust if they come back wrong, and it is
one string in `supabase/functions/design-workout/index.ts`.

It was deployed from the dashboard, not the CLI. `supabase functions deploy`
fails in this repo because `supabase/` sits at `MacroTracker/supabase`, one
level below the git root, and the API-based deploy declares an entrypoint of
`supabase/functions/<name>/index.ts` relative to a tree rooted higher up —
hence `Entrypoint path does not exist`. Both functions are single files with
no imports, so pasting into the dashboard is a complete deploy. Worth
solving properly before there is a third function.

No new secret — it reads the same `GEMINI_API_KEY` that `analyze-meal`
already uses, and shares that key's free-tier quota, which is worth
remembering if meal analysis ever starts returning 429s after a day of
program generation.

---

## 1.0.7 has to be a native build

Not an OTA update. `app.json` declares the Time Sensitive notifications
entitlement, which only takes effect in a new binary — pushing 1.0.7 over the
air would ship the recovery alert without the thing that lets it through
Focus, which is the whole point of it.

The widget is now a second reason. `targets/widget/index.swift` is compiled
into the extension, so no amount of JS pushed over the air changes a pixel of
it; the redesigned layout and the over-state fix only exist in a new build.
The payload is unchanged, so an old binary keeps working against new JS — it
just keeps the old layout, and keeps showing "0 cal left" in the accent color
on a day somebody went over.

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
