---
version: 1
slug: "targets-watch-content-swift"
primary_target: "targets/watch/content.swift"
related_targets: ["src/services/watch.ts","src/hooks/useWatchSync.ts"]
---

# Watch companion

Scope: the watchOS day screen, wrist-side logging of water and saved meals, and
a watch-face complication set. Visitor mode: **Operate**.

Audience and job: one user, two scenes — mid-set with divided attention, and
mid-meal in company. He reaches the watch exactly when the phone is not in his
hand. Task: read one number properly, or log one thing, in seconds.

Proof already in the build: `addWater(date, oz)` and `savedMeals` exist in the
store; `sendReliable` already carries watch→phone writes with retry and
optimistic local update. Nothing here is invented, only extended.

Untouched: every workout screen, `WorkoutManager`, the WCSession transport,
the palette sync, the ichthys, the iOS widget. The watch still never writes to
Apple Health.

Unresolved: none blocking. `Log Meal` sits on the Calories stop rather than
earning its own; raised with the user and left as asserted.

## Direction contract

THESIS: One screen you scroll, led by a dial big enough to read without
looking properly, with the whole-day audit also on the watch face as a
complication. This replaced a seven-stop crown-paged stack (Crown Stack),
which was built, shipped and then withdrawn in use: giving every reading its
own panel made each dial SMALLER than the screen could afford once a label
and caption sat under it, and auditing the day took six crown turns.

OWN-WORLD: Executive pack unchanged — #0E0E10 ground, #34C77B accent, #F4756D
over-goal, macros #E2683C / #E0A32E / #D1699B / #79C993, water #5A9FD4,
secondary #9A9AA2. One card-filling DM Serif Display numeral per stop, at a
size the app uses nowhere else. Manrope 600/700 for every label, uppercase and
tracked, 9–11pt. One 5pt round-capped arc per stop, set behind the numeral
rather than around it, track at 16%.

STORY: He raises his wrist and reads one number properly instead of squinting
at five. For the whole day he reads the complication, not the app. Water and a
repeat meal become two taps on the wrist instead of a phone.

FIRST VIEWPORT: A 118pt ring, 10pt stroke, DM Serif numeral at 36 inside it
over `CAL LEFT` in tracked Manrope. Protein and Carbs sit beneath it as
labelled bars; Fat, Fiber, water and Start Workout are one short scroll down.
All four macros above the fold was the intent and measurement killed it — a
macro bar is ~26pt, so four plus gaps need ~116, which caps the ring near 93
on a 242pt screen, and 93 was the size being complained about. The constraint
was dropped rather than half-met.

FORM: Vertical scroll, hero ring over macro bars — index 7 of seven on the
ordered list, and the one the roll's hand was meant to break away from. It won
on use rather than on the table: Crown Stack was built and lived with, and the
dial size it forced is what sent it back. The wrist is read-only again; the
briefly-shipped water and saved-meal logging came out with it, a meal being
slower to pick on a watch than on the phone it came from.
seed:e3babe81de9fb16c

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
