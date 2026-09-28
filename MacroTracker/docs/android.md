# Android

One codebase, two platforms. Nothing about the Android build is a fork — the
screens, store, sync and theme packs are the same files iOS runs.

## Building it

```sh
npx expo prebuild --platform android --clean   # regenerate android/ from app.json
eas build -p android --profile preview          # installable APK
eas build -p android --profile production       # .aab for Play
```

`android/` is gitignored. It is regenerated from `app.json` on every build
(Continuous Native Generation), so edits made inside it are lost — change
`app.json` or a config plugin instead.

## What differs from iOS

| | iOS | Android |
|---|---|---|
| Heart rate, active energy | HealthKit | Health Connect |
| Apple Watch companion | Yes | Not applicable |
| Home screen widget | WidgetKit | Not built yet |
| Sign in with Apple | Yes | Hidden; email and Google remain |
| Workout type / set type pickers | `ActionSheetIOS` | `Alert` with one button per option |

Everything else — logging, the meal photo and label scanning, templates, the
body map, the consistency grid, PRs, adaptive goals, Supabase sync, all three
theme packs — is shared and behaves identically.

### Heart rate and active energy

`src/services/heartRate.ts` exposes one `HeartRateMonitor` interface with a
HealthKit implementation and a Health Connect one; `getHeartRateMonitor()`
picks by platform and nothing upstream knows which it got. Health Connect is
the aggregator that Wear OS, Galaxy Watch, Fitbit and Whoop all write into, so
the app reads whatever the user already wears without integrating with any of
them.

Two shape differences are worth knowing when editing that file:

* **No live subscription.** HealthKit has `subscribeToChanges`; Health Connect
  has nothing equivalent, so the live readout polls every 5s and looks back a
  minute so it isn't blank the moment a workout opens.
* **Records, not samples.** One Health Connect `HeartRate` record holds many
  samples, and records from two sources can overlap, so every read flattens
  and re-sorts before use.

Active energy uses `aggregateRecord('ActiveCaloriesBurned')`. It answers an
empty window with `0` rather than with nothing, so a zero is treated as no
data — a rest day and a day without a wearable must not look the same.

### Permissions

The release manifest carries exactly: `CAMERA`, `INTERNET`, `VIBRATE`,
`READ`/`WRITE_EXTERNAL_STORAGE` (capped at API 32, from the image picker), and
the two Health Connect reads.

`RECORD_AUDIO` and `SYSTEM_ALERT_WINDOW` are both removed at manifest merge and
should stay that way. expo-camera and expo-image-picker each add the former by
default and neither is used to record anything; prebuild adds the latter for
the dev overlay, and Play asks you to justify a permission the app never uses.
They are suppressed by `microphonePermission: false`,
`recordAudioAndroid: false` and `android.blockedPermissions` in `app.json` —
check `npx expo prebuild` output if a new dependency reintroduces one.

Health Connect itself needs no runtime permission prompt of ours: the
`react-native-health-connect` config plugin wires the rationale intent filter
and the `ViewPermissionUsageActivity` alias that Android 14 requires, and
`requestPermission()` opens the system dialog.

### The iOS-only services

`src/services/watch.ts` and `src/services/widget.ts` are imported at launch —
by the store and by `useWidgetSync` — and both bind to native modules that
exist only on iOS. They `require()` those on demand behind a `Platform` check
rather than importing them at the top of the file: a static import is
evaluated before any check inside the module can run, and
`@bacons/apple-targets` resolves an Expo native module that an Android build
does not contain. Keep new iOS-only dependencies on the same pattern.

## Not done

* **Home screen widget.** `updateMacroWidget` already no-ops off iOS, so
  nothing depends on it. Android needs its own Glance implementation and a
  second copy of the palette to keep in step with `src/theme`.
* **Play Store listing.** `marketing/app-store-listing.md` covers iOS only;
  Play wants its own screenshot sizes and a 1024×500 feature graphic.
* **Device testing.** None of this has run on a device or emulator. Prebuild
  configures and both platforms bundle, which is all a CI container can prove.
