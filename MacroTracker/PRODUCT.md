# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Stack

Expo SDK 56 / React Native 0.85.3, TypeScript. Zustand with `persist` for local
state, Supabase (PostgREST) for auth and cloud sync. Native integrations:
HealthKit on iOS (`@kingstinct/react-native-healthkit`), Health Connect on
Android (`react-native-health-connect`), a watchOS companion target and an iOS
WidgetKit target via `@bacons/apple-targets`. Builds through EAS.

## Users

The primary user is the app's author, who uses it daily for his own training and
nutrition, plus a small circle of TestFlight testers. Not a general-audience
consumer app with a funnel; its design decisions have always been settled by
whether they survive real daily use.

The real scene is specific and recurring: logging a set mid-workout, one-handed,
phone propped on a bench, between reps; and logging a meal at a table, often in
company, wanting it done in seconds rather than wanting to browse a database.

## Product Purpose

Track calories, macros and training in one app, so that nutrition and lifting
are read against each other rather than in two separate tools. Success is
sustained daily logging — the app earns its place by being fast enough to use
mid-set and mid-meal, and by keeping goals accurate as body weight moves.

## Positioning

Three things a neighboring tracker cannot truthfully copy as a set:

1. **Photograph the plate.** AI estimates the foods and their macros from a
   meal photo, and each detected item stays editable before logging.
2. **Scan the real label.** A Nutrition Facts label can be captured and read
   directly, rather than trusting a barcode database's entry for the product.
3. **Goals that do not go stale.** Targets re-derive from logged body weight,
   so a cut or a bulk does not silently invalidate them.

The category's own head term, "calorie and macro tracker", is owned by the
incumbents and is deliberately not the lead claim.

## Operating Context

Daily use is two rituals, not one. Nutrition logging happens several times a
day in short bursts, frequently with a camera. Training happens in one
concentrated session, with the phone or the watch, where the app is operated
with sweaty hands and divided attention and a mis-tap costs real data.

A watchOS companion runs the live workout — heart rate streaming, set logging —
and a workout can be started from either phone or watch. The same is true of a
sauna or cold plunge, which run as a retention timer rather than a set list:
both sides can start one, and either can end it. Apple Health / Health Connect
supply heart rate and active energy. An iOS home-screen widget shows the day's
progress.

## Capabilities and Constraints

Confirmed, shipping:

- **Food logging** — search, barcode scan, Nutrition Facts label capture, meal
  photo analysis, saved meals, multi-item meal builder, custom foods, copy
  yesterday, favorites, four meal windows.
- **Goals** — calories plus protein / carbs / fat / fiber, a goal wizard that
  derives them from profile and activity, macro split presets, optional
  adaptive updates driven by logged body weight, hydration target.
- **Training** — workout templates, live session with sets, reps, weight and
  set type, exercise reordering, editable completed workouts, body-region
  coverage heat map, per-exercise progress charts.
- **Physiology** — heart rate with training zones, active energy read from the
  platform health store.
- **Review** — history by day, key insights (streak, logged days, weight
  change, consistency, volume).
- **Platform** — email/Apple auth, cloud sync, local notification reminders,
  three selectable theme packs.

Constraints:

- The **phone** reads from Apple Health and never writes to it. Copy and design
  must not imply otherwise. The one thing that writes is the watch's own
  HKWorkoutSession, which is how a live session works at all — lifts and
  recovery sessions alike land in Fitness, recovery as "Other".
- `BodyHeatMap` replaced an earlier training-split donut; the donut must not
  return.
- Watch functionality is iOS-only; the Android port deliberately ships without
  it, and without the home-screen widget.
- Accessibility is a known, accepted gap: there are no accessibility labels or
  roles on any control, and a number of tap targets sit under 44pt. The owner
  has deferred this; it is recorded, not resolved.

## Brand Commitments

- Name **HolyMacro**; App Store name `HolyMacro: Macro Tracker`, subtitle
  `Tracking Simplified`
- The app mark is an **ichthys** outline, shipping across iOS, Android, the
  watch and the widget. The name and mark carry a deliberate faith reference;
  it is an identity element, not a feature, and the app contains no religious
  content.
- Three named theme packs exist as a shipped feature — Executive (default),
  Modern, Wellness — each a complete identity rather than a light/dark variant.
  Whether a replacement world keeps three packs is open.

## Evidence on Hand

- Six App Store slides at `marketing/appstore/`, generated by
  `marketing/appstore/gen.py`, and listing copy at
  `marketing/app-store-listing.md` with every claim checked against the build.
- One real meal photograph, deliberately gitignored for privacy; only its
  cropped render is committed.
- **No** testimonials, press, user counts, benchmarks or case studies exist.
  None may be fabricated. The tester circle is small and unquantified.

## Product Principles

1. **Speed in the real scene beats completeness.** The app is operated mid-set
   and mid-meal; anything that costs a second costs adherence.
2. **Capture beats data entry.** The camera paths — plate, label — are the
   product's own mechanism; typing is the fallback, not the centre.
3. **Numbers must stay honest.** Adaptive goals, editable history and real
   label reads all exist because a wrong number silently corrupts weeks of
   tracking.
4. **Nutrition and training are one picture.** They are tracked together
   because they are read against each other.
5. **Explain, don't assert.** Where the app computes a target, it says why —
   this is the one thing it does that a calculator does not.

## Accessibility & Inclusion

No standard has been adopted. The gap above is documented and owner-deferred.
Any new work should label shared components as it creates them, since doing so
at creation is near-free and retrofitting 320 call sites is not.
