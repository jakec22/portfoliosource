# MacroTracker — iOS Development Setup

This project is an [Expo](https://expo.dev) (SDK 56) React Native app, fully
configured for native iOS builds. The native `ios/` Xcode project is committed,
so you can open it directly — or rebuild it from config at any time.

There are **two ways** to build for iOS. Pick based on whether you have a Mac.

---

## Prerequisites (both paths)

- **Node.js 20+** — `node --version`
- An **[Apple Developer account](https://developer.apple.com/programs/)**
  ($99/year) — required to run on a physical device or ship to the App Store.

---

## Path A — Build locally in Xcode (requires a Mac)

You need a Mac with **Xcode** (from the Mac App Store) and **CocoaPods**
(`sudo gem install cocoapods` or `brew install cocoapods`).

```bash
cd MacroTracker

# 1. Install JS dependencies
npm install

# 2. Install the native iOS pods
cd ios && pod install && cd ..

# 3. Open the workspace in Xcode  (NOT the .xcodeproj)
open ios/MacroTracker.xcworkspace
```

In Xcode:
1. Select the **MacroTracker** target → **Signing & Capabilities** tab.
2. Choose your **Team** (your Apple Developer account). Xcode auto-manages
   the signing certificate and provisioning profile.
3. Pick a run destination (a simulator, or your plugged-in iPhone).
4. Press **▶ Run**.

> If you change anything in `app.json` (icons, name, permissions), regenerate
> the native project with `npx expo prebuild --clean`, then re-run `pod install`.

You can also skip Xcode and run from the terminal:
```bash
npx expo run:ios            # simulator
npx expo run:ios --device   # physical device
```

---

## Path B — Build in the cloud with EAS (no Mac needed)

[EAS Build](https://docs.expo.dev/build/introduction/) compiles on Apple
hardware in the cloud and can ship straight to TestFlight.

```bash
cd MacroTracker

# 1. Install the EAS CLI and log in (free Expo account)
npm install -g eas-cli
eas login

# 2. Build a production iOS app  (prompts for Apple credentials, handles certs)
eas build --platform ios --profile production

# 3. Submit the finished build to App Store Connect / TestFlight
eas submit --platform ios --profile production
```

Build profiles are defined in `eas.json`:
- `development` — dev client for debugging, runs on simulator
- `preview` — internal test build (simulator)
- `production` — release build, auto-increments the build number

---

## App configuration

Key settings live in `app.json`:

| Field | Value | Change to… |
|---|---|---|
| `ios.bundleIdentifier` | `com.macrotracker.app` | your own reverse-domain id |
| `version` | `1.0.0` | marketing version shown on the store |
| `ios.buildNumber` | `1` | bump per upload (EAS auto-increments) |
| `newArchEnabled` | `true` | React Native New Architecture (Fabric) |

---

## Before shipping to the App Store

- [ ] Replace placeholder art in `assets/` (icon `1024×1024`, splash).
- [ ] Set your own `bundleIdentifier` in `app.json`.
- [ ] Create the app record in **App Store Connect**.
- [ ] Add screenshots, description, privacy details.
- [ ] Consider a real food database/API (current list is a 25-item starter) —
      e.g. USDA FoodData Central or Open Food Facts, plus barcode scanning.

---

## Regenerating the native project

The `ios/` folder is generated from `app.json`. If it ever gets out of sync:

```bash
npx expo prebuild --clean        # regenerate ios/ (and android/ if present)
cd ios && pod install && cd ..
```
