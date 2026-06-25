// Centralized theme tokens for light/dark mode.
//
// The app historically hardcoded Tailwind hex colors everywhere. This module
// defines semantic tokens (bg/card/text/border/...) plus a raw gray ramp so
// screens can swap a static `StyleSheet.create({...})` for a small factory
// `makeStyles(c)` that reads colors off the active Theme.
//
// Dark mode is built by inverting the grayscale ramp (gray-50 ↔ near-black,
// gray-900 ↔ near-white) and keeping brand colors (emerald/red/amber/blue)
// roughly constant, brightening a touch where needed for contrast on dark.

export type { ThemeMode } from '../types';
import type { ThemeMode } from '../types';

export interface Theme {
  scheme: 'light' | 'dark';

  // Surfaces
  bg: string; // app background
  card: string; // elevated card / sheet / row
  cardMuted: string; // subtle inset fill, secondary surface
  input: string; // text input background

  // Text
  text: string; // primary text
  textMuted: string; // secondary text
  textFaint: string; // tertiary text / placeholder / disabled

  // Lines
  border: string; // hairline border / divider
  borderStrong: string; // heavier border (e.g. outlined buttons)

  // Brand + semantic
  primary: string;
  primaryDark: string;
  primarySoft: string; // tinted background behind primary chips/badges
  onPrimary: string; // text/icon sitting on a primary-colored surface
  danger: string;
  dangerSoft: string;
  warning: string;
  warningSoft: string;
  info: string;
  infoSoft: string;
  accent: string; // indigo/violet
  accentSoft: string;

  // Misc
  shadow: string;
  overlay: string; // modal scrim

  // Raw gray ramp (escape hatch for 1:1 hex replacements)
  gray900: string;
  gray700: string;
  gray500: string;
  gray400: string;
  gray300: string;
  gray200: string;
  gray100: string;
  gray50: string;
  white: string; // surface-white → becomes a dark card in dark mode
}

export const lightTheme: Theme = {
  scheme: 'light',

  bg: '#F9FAFB',
  card: '#FFFFFF',
  cardMuted: '#F3F4F6',
  input: '#F9FAFB',

  text: '#111827',
  textMuted: '#6B7280',
  textFaint: '#9CA3AF',

  border: '#E5E7EB',
  borderStrong: '#D1D5DB',

  primary: '#10B981',
  primaryDark: '#059669',
  primarySoft: '#ECFDF5',
  onPrimary: '#FFFFFF',
  danger: '#EF4444',
  dangerSoft: '#FEE2E2',
  warning: '#F59E0B',
  warningSoft: '#FEF3C7',
  info: '#3B82F6',
  infoSoft: '#EFF6FF',
  accent: '#6366F1',
  accentSoft: '#EDE9FE',

  shadow: '#000000',
  overlay: 'rgba(0,0,0,0.5)',

  gray900: '#111827',
  gray700: '#374151',
  gray500: '#6B7280',
  gray400: '#9CA3AF',
  gray300: '#D1D5DB',
  gray200: '#E5E7EB',
  gray100: '#F3F4F6',
  gray50: '#F9FAFB',
  white: '#FFFFFF',
};

export const darkTheme: Theme = {
  scheme: 'dark',

  bg: '#0E1116',
  card: '#1A1F27',
  cardMuted: '#252B35',
  input: '#252B35',

  text: '#F3F4F6',
  textMuted: '#9CA3AF',
  textFaint: '#6B7280',

  border: '#2A313C',
  borderStrong: '#3A424E',

  primary: '#10B981',
  primaryDark: '#34D399',
  primarySoft: 'rgba(16,185,129,0.16)',
  onPrimary: '#FFFFFF',
  danger: '#F87171',
  dangerSoft: 'rgba(239,68,68,0.18)',
  warning: '#FBBF24',
  warningSoft: 'rgba(245,158,11,0.18)',
  info: '#60A5FA',
  infoSoft: 'rgba(59,130,246,0.18)',
  accent: '#A78BFA',
  accentSoft: 'rgba(139,92,246,0.18)',

  shadow: '#000000',
  overlay: 'rgba(0,0,0,0.6)',

  gray900: '#F3F4F6',
  gray700: '#D1D5DB',
  gray500: '#9CA3AF',
  gray400: '#6B7280',
  gray300: '#4B5563',
  gray200: '#374151',
  gray100: '#252B35',
  gray50: '#1A1F27',
  white: '#1A1F27',
};

export function resolveTheme(mode: ThemeMode, systemScheme: string | null | undefined): Theme {
  if (mode === 'system') return systemScheme === 'dark' ? darkTheme : lightTheme;
  return mode === 'dark' ? darkTheme : lightTheme;
}
