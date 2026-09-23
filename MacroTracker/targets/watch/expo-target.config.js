/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = config => ({
  type: "watch",
  displayName: "Holy Macro",
  icon: '../../assets/icon.png',
  // Baked into the target's asset catalog at build time, so no theme sync can
  // change it — it only shows in UI the system draws before or outside our own
  // views. Kept at the Executive pack's accent, lifted to 4.5:1 against the
  // watch ground the same way watchPalette() lifts it, so it matches what the
  // phone pushes for the default pack instead of the app's retired emerald.
  colors: { $accent: "#569370" },
  deploymentTarget: "9.4",
  entitlements: {
    "com.apple.developer.healthkit": true,
  },
});