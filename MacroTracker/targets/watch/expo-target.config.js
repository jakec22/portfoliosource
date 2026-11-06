/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = config => ({
  type: "watch",
  displayName: "Holy Macro",
  icon: '../../assets/icon.png',
  // Baked into the target's asset catalog at build time, so no theme sync can
  // change it — it only shows in UI the system draws before or outside our own
  // views. It is the Executive pack's primary verbatim: the pack is dark on
  // the same ground the watch paints, so the colour already clears 4.5:1
  // there and needs no separate lift.
  colors: { $accent: "#34C77B" },
  // 10.0, raised from 9.4. The day stack pages with `.verticalPage`, which is
  // the watch's own idiom for a stack of readings and is watchOS 10+. The
  // raise costs nothing: watchOS 9 and watchOS 10 both require an Apple Watch
  // Series 4 or later, so the device floor does not move, and watchOS 10's
  // iOS 17 pairing requirement is already the app's floor via the widget
  // target, which deploys to 17.0.
  deploymentTarget: "10.0",
  entitlements: {
    "com.apple.developer.healthkit": true,
    // Shares a container with the watch's own complication target, which
    // cannot reach the phone's App Group. The watch app is the writer; see
    // persistSnapshot() in content.swift.
    "com.apple.security.application-groups":
      config.ios.entitlements["com.apple.security.application-groups"],
  },
});