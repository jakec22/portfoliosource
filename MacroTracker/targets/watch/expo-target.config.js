/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = config => ({
  type: "watch",
  displayName: "Holy Macro",
  icon: '../../assets/icon.png',
  // Baked into the target's asset catalog at build time, so no theme sync can
  // change it — it only shows in UI the system draws before or outside our own
  // views. It is the Executive pack's primary verbatim: now that the pack is
  // dark on the same #221F1B ground the watch paints, the colour already
  // clears 4.5:1 there and needs no separate lift.
  colors: { $accent: "#6AA885" },
  deploymentTarget: "9.4",
  entitlements: {
    "com.apple.developer.healthkit": true,
  },
});