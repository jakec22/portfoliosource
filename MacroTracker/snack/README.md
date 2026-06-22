# Run MacroTracker on Expo Snack (no local setup)

This folder contains a **single-file** build of the whole app, made for
[snack.expo.dev](https://snack.expo.dev). Nothing to install locally.

## Steps

1. Open **https://snack.expo.dev** in your browser.
2. In the file list on the left, open `App.js`.
3. Select all the existing code and delete it.
4. Open `snack/App.tsx` from this repo, copy the **entire** file, and paste it in.
5. Snack auto-detects the imports. If a banner appears asking to add missing
   packages, click **"Add dependencies"** (or accept the suggested versions).
   The packages it needs:
   - `react-native-svg`
   - `zustand`
   - `@react-native-async-storage/async-storage`
   - `@react-navigation/native`
   - `@react-navigation/bottom-tabs`
   - `@react-navigation/stack`
   - `react-native-screens`
   - `react-native-safe-area-context`
   - `react-native-gesture-handler`
6. On the right, choose a preview:
   - **My Device** tab → scan the QR code with **Expo Go** on your iPhone, or
   - **Web** tab → runs instantly in the browser.

That's it — the full app (Today / History / Goals tabs, food logging, water
tracking, persistent storage) runs in the Snack preview.
