/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = config => ({
  type: "watch-widget",
  displayName: "Holy Macro",
  icon: '../../assets/icon.png',
  // Executive primary, same value the watch app and the iOS widget carry.
  // Baked into the asset catalog at build time, so it is what the system
  // draws before our own views render.
  colors: { $accent: "#34C77B" },
  // Matches the watch app. Complications themselves only need watchOS 9, but
  // a lower floor here than the app it ships inside buys nothing.
  deploymentTarget: "10.0",
  entitlements: {
    // The same group the watch app writes its snapshot into. On watchOS this
    // container is the watch's own — it is not the phone's group of the same
    // name, and nothing syncs between them — so the watch app is the only
    // writer and this extension is the only reader.
    //
    // Kept explicit rather than leaning on the plugin's appGroupsByDefault,
    // for the same reason the iOS widget does: a change to app.json should
    // never silently desync the two.
    "com.apple.security.application-groups":
      config.ios.entitlements["com.apple.security.application-groups"],
  },
});
