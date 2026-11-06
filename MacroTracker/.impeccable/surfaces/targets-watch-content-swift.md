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

THESIS: Each number owns a whole screen and the Digital Crown is the only
navigation; the day's audit moves off the app and onto the watch face. Refuses
the arrangement this watch shipped and every tracker's watch app ships — one
scrolling column of small stacked bars, none of which can be read without
looking properly.

OWN-WORLD: Executive pack unchanged — #0E0E10 ground, #34C77B accent, #F4756D
over-goal, macros #E2683C / #E0A32E / #D1699B / #79C993, water #5A9FD4,
secondary #9A9AA2. One card-filling DM Serif Display numeral per stop, at a
size the app uses nowhere else. Manrope 600/700 for every label, uppercase and
tracked, 9–11pt. One 5pt round-capped arc per stop, set behind the numeral
rather than around it, track at 16%.

STORY: He raises his wrist and reads one number properly instead of squinting
at five. For the whole day he reads the complication, not the app. Water and a
repeat meal become two taps on the wrist instead of a phone.

FIRST VIEWPORT: Stop one, Calories. Date top-left at 9pt tracked — chrome, not
an eyebrow. Card-filling numeral centred over a 152pt arc, `1,420 / 2,000`
beneath at 10pt in the faint grey. `Log Meal` sits at the bottom edge. The
system vertical page indicator runs down the right; seven stops, this is one.

FORM: Crown Stack — index 4 of seven on my ordered list, dealt by the roll and
locked by the user over the dealt lead. seed:e3babe81de9fb16c

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
