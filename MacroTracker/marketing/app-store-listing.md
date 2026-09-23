# App Store listing — HolyMacro

Positioning follows the marketing playbook: lead with the two things no other
tracker does well (photograph the plate, read the real label), then the thing
that keeps people from churning (goals that don't go stale). The old listing
opened on "calorie and macro tracker," which is the one phrase the category
leaders already own.

Every claim below is checked against the shipping app. Notably there is **no**
training-split donut any more — `BodyHeatMap` replaced it — and the app reads
from Apple Health but never writes to it (`app.json`:
`NSHealthUpdateUsageDescription`). Don't let either creep back into the copy.

---

## App name — 24 / 30

```
HolyMacro: Macro Tracker
```

The name field carries the most ASO weight of any field, and "HolyMacro" alone
is a brand nobody is searching for yet. The suffix buys the head term without
making the name read like a keyword dump.

## Subtitle — 28 / 30

```
Snap food. Scan real labels.
```

"real" is doing the work: it sets up the barcode-database complaint that the
second screenshot pays off.

## Promotional text — 161 / 170

Editable without submitting a build — use it for whatever shipped most
recently.

```
New: goals that recalculate themselves when you weigh in, a body map of where
your training volume actually went, and macros on your Home Screen and Apple
Watch.
```

## Keywords — 98 / 100

No spaces after commas (they count). Words already in the app name and
subtitle are indexed automatically, so `macro`, `tracker`, `food`, `label`,
`scan` and `snap` are deliberately absent here.

```
calorie,counter,diary,barcode,scanner,meal,photo,workout,gym,lifting,strength,fiber,protein,weight
```

## Description — 2,721 / 4,000

Only the first ~3 lines show before "more," so the hook has to land in the
first sentence.

```
Most trackers make you type what you ate. HolyMacro lets you show it.

Point the camera at your plate and the macros come back in seconds. Point it at
a Nutrition Facts panel and you get the numbers printed on the package — not
whatever a crowdsourced barcode database happens to say. Your lifts live in the
same app, on the same day, so nutrition and training finally stop being two
separate chores.


THREE THINGS IT DOES DIFFERENTLY

1. Photograph the plate
Snap a meal and get calories, protein, carbs, fat and fiber back without
searching a database or guessing at portions. Adjust anything that looks off,
then save it to breakfast, lunch, dinner or a snack.

2. Read the real label
Barcode databases go stale the moment a brand reformulates. HolyMacro's camera
reads the actual Nutrition Facts panel on the package in front of you, so the
numbers you log are the numbers on the box. Barcode scanning is still there
when you want the fast path.

3. Goals that keep up with you
Other apps make you re-run a setup wizard every time your weight changes.
HolyMacro watches your weigh-ins, smooths out the day-to-day water swings, and
recalculates your calories and macros once you've actually drifted — then tells
you exactly what changed and why. One tap turns it off if you'd rather set your
own numbers.


NUTRITION
• Calories, protein, carbs, fat and fiber as progress bars you can read at a
  glance, not another wall of rings
• Photo logging, Nutrition Facts label scanning and barcode scanning
• Build and save your own meals and custom foods
• Water tracking, switchable off if you don't want it — on the phone and the
  watch together
• Home Screen widgets for your macros, or for calories alone

TRAINING
• Log sets, reps and weight from your saved templates, or build a session as
  you go
• Live Apple Watch heart rate while you train, with the line colored by the
  training zone you're actually in
• A body map of where your volume went — front and back, by muscle group
• A twelve-week consistency grid, current streak and weekly volume trend
• Recent personal records as a chart you can read, not a table you have to
  parse

APPLE WATCH
• Start, pause and finish workouts from your wrist
• Today's macros, calories and water on the watch, in the same theme as your
  phone
• If a session is ever interrupted, the app picks it back up where it left off
  instead of quietly losing it

MADE TO LOOK LIKE SOMETHING
Three theme packs — Executive, Modern and Wellness — each with its own
typography and palette, applied across the phone, the widgets and the watch.

PRIVACY
HolyMacro reads heart rate and active energy from Apple Health to show them
during workouts. It never writes anything back to Health.
```

## What's New (for 1.0.3)

```
• Macros are horizontal progress bars now — easier to read than four rings
• Goals recalculate themselves as your weight moves, and tell you what changed
• New Exercise and Key Insights pages: body map, heart-rate training zones,
  consistency grid and weekly volume
• Home Screen widgets for macros and for calories
• The watch matches your phone's theme, hides water when you've turned it off,
  and recovers a workout that gets interrupted mid-session
```

---

## Screenshots

`marketing/appstore/appstore-{1..6}.png`, 1284 × 2778 (6.5" / 6.7"). Order
matters: App Store search results only show the first three.

| # | Kicker | Headline | Shows |
|---|--------|----------|-------|
| 1 | AI meal photo | Snap it. / It's logged. | Meal Photo result → macro bars |
| 2 | Smart camera | Read the label. / Know the truth. | Nutrition Facts capture |
| 3 | Nutrition | Every macro, / one glance. | Home: calorie ring, macro bars, water |
| 4 | Adaptive goals | Targets that / follow your weight. | Goals-updated card, weight trend |
| 5 | Training insights | See where the / work actually went. | Body map, consistency, volume |
| 6 | Live training | Every set. / Every beat. | Set logger with HR zone chart |

### Regenerating them

`marketing/appstore/gen.py` writes six standalone HTML slides; `shoot.js`
renders them through Playwright at a 428 × 926 viewport and
`deviceScaleFactor: 3`, which lands exactly on 1284 × 2778.

```sh
cd marketing/appstore
python3 gen.py
node shoot.js 3 appstore     # arg 1 = scale, arg 2 = output prefix
node shoot.js 1 preview      # 1x, for a quick look
```

Playwright is required rather than `chrome --headless --screenshot`: that flag
reserves ~87px of the window for browser chrome, so the viewport ends up
shorter than the page and everything below it silently fails to paint. The
in-slide UI is rebuilt from the real `src/theme` tokens and mirrors
`MacroBar.tsx` and `GoalsUpdatedCard.tsx` — if the palette moves, update the
constants at the top of `gen.py`.
