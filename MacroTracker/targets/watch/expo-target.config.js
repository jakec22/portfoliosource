/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = config => ({
  type: "watch",
  icon: 'https://github.com/expo.png',
  colors: { $accent: "#10B981", },
  deploymentTarget: "9.4",
  entitlements: { /* Add entitlements */ },
});