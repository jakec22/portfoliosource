// The app's icon set.
//
// Everything here used to be an emoji or a Unicode glyph — ✨ 🔥 🎯 💪 💧 📈
// 🍽 🏋 ❤ 🔑 📋 💾 ★ 🔍 for concepts, and → ✕ ↑ ↓ ✓ ▲ ▼ for controls. That
// fails three ways at once: emoji render differently on every OS version,
// they cannot be tinted to the active theme pack (🔥 was the same orange in
// Executive as in Wellness), and they cannot be sized on a scale. A screen
// reader also reads ✕ as "multiplication x" and → as "rightwards arrow".
//
// One family, MaterialCommunityIcons, drawn at one stroke weight. Feather was
// the first choice but has no flame, dumbbell, muscle or cutlery glyph, and
// bending those four onto near-matches is how an icon set starts looking
// borrowed.
//
// Call sites name the *concept*, not the glyph: <Icon name="streak" />, never
// <Icon name="fire" />. That indirection is the point — swapping in a bespoke
// family later is then an edit to this file alone, not to seventy call sites.

import React from 'react';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { StyleProp, TextStyle } from 'react-native';

// Concept -> glyph. Add a concept here rather than reaching for a glyph name
// at the call site.
const GLYPH = {
  // Nutrition
  meal: 'silverware-fork-knife',
  protein: 'arm-flex',
  water: 'water',
  food: 'food-apple-outline',
  barcode: 'barcode-scan',

  // Training
  workout: 'dumbbell',
  heart: 'heart',
  streak: 'fire',
  bodyWeight: 'scale-bathroom',
  // Recovery. `fire` is already the streak, so heat is the rising-waves glyph
  // rather than a second flame.
  sauna: 'heat-wave',
  plunge: 'snowflake',

  // Progress
  goal: 'target',
  trends: 'trending-up',
  trendDown: 'trending-down',
  balance: 'scale-balance',
  insights: 'chart-line',
  calendar: 'calendar-blank-outline',

  // Actions
  aiEstimate: 'auto-fix',
  search: 'magnify',
  camera: 'camera-outline',
  gallery: 'image-outline',
  save: 'content-save-outline',
  templates: 'clipboard-text-outline',
  edit: 'pencil-outline',
  remove: 'delete-outline',
  settings: 'cog-outline',
  key: 'key',
  add: 'plus',
  subtract: 'minus',
  more: 'dots-horizontal',

  // State
  favorite: 'star',
  favoriteOff: 'star-outline',
  check: 'check',
  close: 'close',

  // Navigation
  home: 'home-variant',
  profile: 'account-circle-outline',

  // Direction
  up: 'chevron-up',
  down: 'chevron-down',
  back: 'chevron-left',
  forward: 'chevron-right',
  arrowUp: 'arrow-up',
  arrowDown: 'arrow-down',
  arrowLeft: 'arrow-left',
  arrowRight: 'arrow-right',
} as const;

export type IconName = keyof typeof GLYPH;

// Sized against the type ramp rather than freely: an icon beside caption text
// is `sm`, beside body text `md`. `hero` is for the one icon that anchors an
// empty state.
export const iconSize = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
  hero: 44,
} as const;

interface Props {
  name: IconName;
  size?: keyof typeof iconSize | number;
  color?: string;
  style?: StyleProp<TextStyle>;
}

export function Icon({ name, size = 'md', color, style }: Props) {
  return (
    <MaterialCommunityIcons
      name={GLYPH[name]}
      size={typeof size === 'number' ? size : iconSize[size]}
      color={color}
      style={style}
    />
  );
}
