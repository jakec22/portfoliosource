# Run MacroTracker on Expo Snack (no local setup)

This folder contains a **single-file** build of the whole app, made for
[snack.expo.dev](https://snack.expo.dev). Nothing to install locally.

The file is **plain JavaScript** (`snack/App.js`) so it pastes straight into
Snack's default `App.js` with no file-renaming needed.

## Steps

1. Open **https://snack.expo.dev** in your browser.
2. In the file list on the left, open `App.js`.
3. Select all the existing code and delete it.
4. Open `snack/App.js` from this repo, copy the **entire** file, and paste it in.
5. In the left sidebar, find the **Dependencies** section and add these three
   packages (click "Add dependency", type each name, accept the version):
   - `react-native-svg`
   - `zustand`
   - `@react-native-async-storage/async-storage`

   (Navigation is built in with plain React state + Modal, so no React
   Navigation packages are needed — this avoids Snack bundler errors.)
6. On the right, choose a preview:
   - **My Device** tab → scan the QR code with **Expo Go** on your iPhone, or
   - **Web** tab → runs instantly in the browser.

That's it — the full app (Today / History / Goals tabs, food logging, water
tracking, persistent storage) runs in the Snack preview.
