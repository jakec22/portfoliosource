/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = config => ({
  type: "widget",
  displayName: "Macros",
  icon: '../../assets/icon.png',
  colors: { $accent: "#3F6B52" },
  deploymentTarget: "17.0",
  entitlements: {
    // Mirrors the main app's group so the widget can read the payload the JS
    // side writes via ExtensionStorage. Kept explicit rather than relying on
    // the plugin's auto-mirroring, so a change to app.json can't silently
    // desync the two.
    "com.apple.security.application-groups":
      config.ios.entitlements["com.apple.security.application-groups"],
  },
});
