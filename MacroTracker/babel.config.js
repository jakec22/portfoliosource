module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // react-native-worklets/plugin powers Reanimated 4 worklets and must be
    // the LAST plugin in the list. Without it, anything that touches
    // Reanimated (React Navigation stack animations, gesture handler) throws
    // "undefined is not a function" at runtime.
    plugins: ['react-native-worklets/plugin'],
  };
};
