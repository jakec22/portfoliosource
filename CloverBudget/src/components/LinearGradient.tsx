// Thin wrapper over expo-linear-gradient that defaults to a horizontal fill,
// so call sites just pass `colors`. Works on iOS, Android, and web.

import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';

export function LinearGradient({
  colors,
  style,
}: {
  colors: string[];
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <ExpoLinearGradient
      colors={colors as [string, string, ...string[]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={style}
    />
  );
}
