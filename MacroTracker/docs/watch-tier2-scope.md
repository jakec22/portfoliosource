# Tier 2 — Apple Watch live workout session

**Goal:** When the user taps **Start Workout** in MacroTracker, the paired Apple
Watch starts a native `HKWorkoutSession` of type *Traditional Strength Training*.
The Watch shows the active-workout ring, switches its heart-rate sensor into
high-frequency (~1 Hz) mode, and streams live BPM back to the phone. Tapping
**Finish** ends the session and HealthKit consolidates the dense HR series that
the summary graph already knows how to render.

This is the only way to truly "start an exercise on the Watch" — that API
(`HKWorkoutSession` / `HKLiveWorkoutBuilder`) is watchOS-only and must run in
native Swift on a Watch target. Our current JS-only HealthKit integration can
only *read* whatever the Watch happens to record; it cannot start a session.

---

## Architecture at a glance

```
  ┌─────────────────────────── iPhone ───────────────────────────┐
  │                                                               │
  │  ActiveWorkoutScreen.tsx                                       │
  │        │ start()/stop()                                       │
  │        ▼                                                       │
  │  services/watchWorkout.ts  ──►  WatchWorkoutBridge (native)    │
  │        ▲  live BPM events            │  WCSession.sendMessage  │
  │        │                             ▼                         │
  └────────┼──────────────────  WatchConnectivity  ───────────────┘
           │                             │
  ┌────────┼──────────────── Apple Watch ┼──────────────────────┐
  │        │                             ▼                        │
  │   WorkoutManager (Swift)  ◄──  WCSession messages             │
  │        │  HKWorkoutSession + HKLiveWorkoutBuilder             │
  │        └──►  live HR delegate  ──►  send BPM back to phone     │
  │   SwiftUI: minimal "Lifting… ❤ 132 bpm" screen                │
  └───────────────────────────────────────────────────────────────┘
```

Two message directions over `WatchConnectivity`:
- **Phone → Watch:** `{ command: "start" | "stop", workoutId, startedAt }`
- **Watch → Phone:** `{ event: "bpm", value, timestamp }`, `{ event: "ended" }`

---

## Work breakdown

### Stage 0 — Project prerequisites (½ day)
- **Bundle identifier alignment.** `app.json` says `com.jacobclover.macrotracker`;
  the committed `ios/` project says `com.macrotracker.app`. A Watch app's bundle
  id must be `<phone-bundle-id>.watchkitapp`, so these must agree first. Decide on
  one id and make `app.json` + the native project match before adding the target.
- **Apple Developer setup.** The Watch app needs its own App ID + provisioning
  profile, and the HealthKit capability must be enabled on it. (EAS can manage
  this, but the identifiers must exist.)
- Confirm test hardware: a real iPhone **paired with a real Apple Watch**. None
  of this runs in Expo Go or the simulator.

### Stage 1 — watchOS app target (1–1.5 days)
New target in `ios/MacroTracker.xcodeproj`. Because Expo's `prebuild` regenerates
the native project, the target has to be injected by a **config plugin** so it
survives regeneration — hand-editing `project.pbxproj` would be wiped on the next
prebuild.

- `plugins/withWatchApp.js` — local Expo config plugin that:
  - adds the watchOS app + extension targets to the pbxproj,
  - sets the Watch bundle id to `<phone>.watchkitapp`,
  - adds the HealthKit entitlement + `NSHealthShareUsageDescription` /
    `NSHealthUpdateUsageDescription` to the Watch Info.plist,
  - copies the Swift sources below into the target.
- Register it in `app.json` `plugins`.
- Watch sources (new folder, e.g. `ios/watch/`):
  - `WatchApp.swift` — `@main` SwiftUI App entry.
  - `WorkoutManager.swift` — owns `HKWorkoutSession` +
    `HKLiveWorkoutBuilder`; `start(activityType: .traditionalStrengthTraining)`,
    `end()`, and the `HKLiveWorkoutBuilderDelegate` that reads HR each update.
  - `WatchConnectivityProvider.swift` — `WCSessionDelegate`; receives
    start/stop from the phone, sends BPM/ended back.
  - `ContentView.swift` — minimal SwiftUI: state ("Waiting" / "Lifting"),
    elapsed time, big ❤ + current BPM.

**Milestone:** install on the Watch, start a session *manually* from the Watch
UI, confirm the workout ring appears and HR goes dense. (No phone link yet.)

### Stage 2 — Phone-side native bridge (1 day)
- `ios/MacroTracker/WatchWorkoutBridge.swift` — an `RCTEventEmitter` native
  module that:
  - `startWorkout(workoutId, startedAt)` → `WCSession.sendMessage` `start`,
  - `stopWorkout()` → `sendMessage` `stop`,
  - implements `WCSessionDelegate` to receive `bpm`/`ended` and emits them to JS
    via `sendEvent(withName:)`.
  - exposes `isWatchReachable()` for the UI to show Watch status.
- `WatchWorkoutBridge.m` (or Swift `@objc` export) — RN module registration;
  reference it from the bridging header.
- This is plain RN native code, **not** a Nitro module — it lives in the existing
  app target. The `withWatchApp` plugin (or a tiny second plugin) ensures the two
  files are added to the pbxproj on prebuild.

**Milestone:** from a JS console / temp button, call start → Watch session begins;
BPM events arrive in JS.

### Stage 3 — JS service + UI wiring (½–1 day)
- `src/services/watchWorkout.ts` — typed wrapper over the native module + an
  `expo-modules`/`NativeEventEmitter` subscription. Mirrors the existing
  `HeartRateMonitor` shape so it can slot into the current code:
  - `available` (true only if `isWatchReachable()` and module present),
  - `requestPermissions()`, `start(onSample)`, `stop()`, `query(start,end)`.
  - Graceful no-op fallback when the native module is absent (Expo Go / no Watch),
    exactly like `heartRate.ts` does today.
- `src/services/heartRate.ts` — add `'watch'` to `HeartRateSource`; when selected
  and a Watch is reachable, prefer the Watch monitor and fall back to the existing
  HealthKit reader otherwise. Keeps the screen code unchanged.
- `ActiveWorkoutScreen.tsx` — already calls `monitor.start/stop/query` around
  `workoutId`; point it at the new source. Add a small "Apple Watch connected"
  indicator near the `WorkoutStatusBar` so the user knows the live session is
  active vs. falling back to passive HealthKit reads.

**Milestone:** tap **Start Workout** on the phone → Watch lights up with the
strength-training session, live BPM streams to the bar, **Finish** ends it and
the summary graph shows the dense series.

### Stage 4 — Build, polish, edge cases (1 day)
- EAS: ensure the dev/preview build compiles the Watch target (may need an
  `eas.json` profile note + credentials for the Watch App ID). Simulator builds
  can't exercise the Watch, so add an internal-distribution device build.
- Edge cases:
  - Watch not paired / not reachable → fall back to current HealthKit reader,
    show passive state in the bar.
  - App backgrounded mid-workout (phone locks): the Watch session keeps running
    independently — verify reconnection re-syncs on foreground.
  - User ends the workout from the Watch instead of the phone → `ended` event
    drives the phone to finalize.
  - Permission denied on the Watch → graceful message, no crash.

---

## New / changed files

| File | New? | Purpose |
|---|---|---|
| `app.json` | edit | register `withWatchApp` plugin; align bundle id |
| `plugins/withWatchApp.js` | new | inject Watch targets + entitlements on prebuild |
| `ios/watch/WatchApp.swift` | new | watchOS `@main` entry |
| `ios/watch/WorkoutManager.swift` | new | `HKWorkoutSession` + live builder |
| `ios/watch/WatchConnectivityProvider.swift` | new | Watch-side WC delegate |
| `ios/watch/ContentView.swift` | new | minimal Watch UI |
| `ios/MacroTracker/WatchWorkoutBridge.swift` | new | phone-side RN native module |
| `ios/MacroTracker/WatchWorkoutBridge.m` | new | RN module registration |
| `src/services/watchWorkout.ts` | new | JS wrapper + event subscription |
| `src/services/heartRate.ts` | edit | add `'watch'` source + fallback logic |
| `src/screens/ActiveWorkoutScreen.tsx` | edit | Watch indicator; point monitor at Watch |
| `eas.json` | edit | build profile for the Watch target |

No changes needed to the data model (`HeartRateSample` / `WorkoutSession`) or the
summary graph — they already consume the sample series.

---

## Estimate & risks

- **Effort:** ~4–5 focused days across the stages above.
- **Hard requirements:** real iPhone + paired Watch; an Apple Developer account
  with the ability to create the Watch App ID; cannot be validated in Expo Go or
  the simulator.
- **Biggest risk:** the config-plugin that injects the Watch target into the
  pbxproj. Adding a second Xcode target via a plugin is the fiddly part —
  community plugins exist (`@bacons/...`, `expo-apple-targets`) and are the
  recommended path rather than writing raw pbxproj mutation by hand.
- **Second risk:** bundle-id alignment touches release identity — do it
  deliberately, as its own commit, before anything else.

---

## Suggested sequencing

1. Stage 0 (bundle id + provisioning) — small but blocking; land it alone.
2. Stage 1 Watch target with manual start — proves the Watch session + HR.
3. Stage 2 bridge — proves the phone↔Watch link.
4. Stage 3 JS wiring — the actual product behavior.
5. Stage 4 build/polish — ship-ready.

Each stage is independently testable, so we can stop after any stage with a
working (if partial) result.
