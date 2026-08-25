// Centralized theme tokens, as selectable "theme packs".
//
// Each pack is a complete, fixed visual identity (colors + the two custom
// font families it loads) rather than a light/dark variant of one palette —
// picking a pack is picking a personality, not a brightness. Screens read
// colors off the active Theme via `useTheme()` and a small `makeStyles(c)`
// factory, so swapping the active pack re-themes the whole app automatically.
//
// Font families reference the constant names exported by the
// @expo-google-fonts/* packages loaded in App.tsx (see the font map there) —
// those constants double as the RN `fontFamily` string once registered via
// expo-font. `fontDisplay` is used for hero numerals (calorie/macro rings);
// `fontBody` is available for screens that want the pack's body face
// explicitly (not applied globally, to avoid an unverified app-wide patch).

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
  accent: string;
  accentSoft: string;

  // Macro ring colors (Home screen)
  macroProtein: string;
  macroCarbs: string;
  macroFat: string;
  macroFiber: string;

  // Misc
  shadow: string;
  overlay: string; // modal scrim

  // Custom font families for this pack (registered names — see App.tsx).
  // Omitted (undefined) on the Classic pack, which intentionally uses the
  // OS system font rather than a custom face.
  fontDisplay?: string; // hero numerals (calorie/macro rings)
  fontBody?: string; // pack's body face, for screens that opt in

  // Raw gray ramp (escape hatch for 1:1 hex replacements)
  gray900: string;
  gray700: string;
  gray500: string;
  gray400: string;
  gray300: string;
  gray200: string;
  gray100: string;
  gray50: string;
  white: string; // surface-white → the pack's card color in a dark pack
}

// Classic: the app's original look, kept as a selectable pack for anyone who
// prefers it over the redesign directions — the same Tailwind-derived palette
// and system font it always used, before theme packs existed.
export const classicTheme: Theme = {
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

  macroProtein: '#3B82F6',
  macroCarbs: '#F59E0B',
  macroFat: '#EF4444',
  macroFiber: '#8B5CF6',

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

// A — Editorial Premium: warm neutrals, one deep-green accent, restrained
// muted hues for the macro rings, serif display numerals.
export const editorialTheme: Theme = {
  scheme: 'light',

  bg: '#F8F5F1',
  card: '#FFFFFF',
  cardMuted: '#F1ECE5',
  input: '#F8F5F1',

  text: '#221F1B',
  textMuted: '#89807D',
  textFaint: '#B5AB9E',

  border: '#E7E0D6',
  borderStrong: '#D6CBBC',

  primary: '#3F6B52',
  primaryDark: '#2F5340',
  primarySoft: '#E7EFEA',
  onPrimary: '#FFFFFF',
  danger: '#B54A3B',
  dangerSoft: '#F5E3DE',
  warning: '#B98A3E',
  warningSoft: '#F3E8D3',
  info: '#5E7A8C',
  infoSoft: '#E7EDF0',
  accent: '#9C5B45',
  accentSoft: '#F0E1D9',

  macroProtein: '#9C5B45',
  macroCarbs: '#B98A3E',
  macroFat: '#A46C74',
  macroFiber: '#6E7B63',

  shadow: '#000000',
  overlay: 'rgba(0,0,0,0.5)',

  fontDisplay: 'DMSerifDisplay_400Regular',
  fontBody: 'Manrope_500Medium',

  gray900: '#221F1B',
  gray700: '#4A443C',
  gray500: '#89807D',
  gray400: '#A79D8F',
  gray300: '#D6CBBC',
  gray200: '#E7E0D6',
  gray100: '#F1ECE5',
  gray50: '#F8F5F1',
  white: '#FFFFFF',
};

// B — Sport-Tech Energy: near-black, neon lime/cyan/pink, bold geometric
// display numerals.
export const sportTechTheme: Theme = {
  scheme: 'dark',

  bg: '#0D1017',
  card: '#171B23',
  cardMuted: '#1F242E',
  input: '#1F242E',

  text: '#F5F7FA',
  textMuted: '#9CA6B4',
  textFaint: '#6B7684',

  border: '#262C37',
  borderStrong: '#343B48',

  primary: '#C9F04D',
  primaryDark: '#A8CC3A',
  primarySoft: 'rgba(201,240,77,0.16)',
  onPrimary: '#0D1017',
  danger: '#F2456B',
  dangerSoft: 'rgba(242,69,107,0.18)',
  warning: '#FBBF24',
  warningSoft: 'rgba(251,191,36,0.18)',
  info: '#22D3EE',
  infoSoft: 'rgba(34,211,238,0.16)',
  accent: '#F2408F',
  accentSoft: 'rgba(242,64,143,0.16)',

  macroProtein: '#C9F04D',
  macroCarbs: '#22D3EE',
  macroFat: '#F2408F',
  macroFiber: '#A78BFA',

  shadow: '#000000',
  overlay: 'rgba(0,0,0,0.65)',

  fontDisplay: 'SpaceGrotesk_700Bold',
  fontBody: 'SpaceGrotesk_500Medium',

  gray900: '#F5F7FA',
  gray700: '#C4CBD4',
  gray500: '#9CA6B4',
  gray400: '#6B7684',
  gray300: '#4A5361',
  gray200: '#343B48',
  gray100: '#262C37',
  gray50: '#1F242E',
  white: '#171B23',
};

// C — Warm Wellness: cream, terracotta/sage/gold, soft rounded display type.
export const warmWellnessTheme: Theme = {
  scheme: 'light',

  bg: '#FBF3EA',
  card: '#FFFDF9',
  cardMuted: '#F3E6D8',
  input: '#FBF3EA',

  text: '#3B2E24',
  textMuted: '#8A7969',
  textFaint: '#B6A896',

  border: '#EEDFCC',
  borderStrong: '#E0CBAE',

  primary: '#C1633F',
  primaryDark: '#A34F30',
  primarySoft: '#F6E3D6',
  onPrimary: '#FFFFFF',
  danger: '#C24B4B',
  dangerSoft: '#F6DEDE',
  warning: '#D6A03E',
  warningSoft: '#F7EAD2',
  info: '#6E9285',
  infoSoft: '#E4EEE9',
  accent: '#7A9A6E',
  accentSoft: '#E7EFE3',

  macroProtein: '#C1633F',
  macroCarbs: '#D6A03E',
  macroFat: '#7A9A6E',
  macroFiber: '#9C7FA0',

  shadow: '#7A4B2E',
  overlay: 'rgba(59,46,36,0.5)',

  fontDisplay: 'BricolageGrotesque_700Bold',
  fontBody: 'NunitoSans_500Medium',

  gray900: '#3B2E24',
  gray700: '#6B5A48',
  gray500: '#8A7969',
  gray400: '#A8977F',
  gray300: '#E0CBAE',
  gray200: '#EEDFCC',
  gray100: '#F3E6D8',
  gray50: '#FBF3EA',
  white: '#FFFDF9',
};

export function resolveTheme(pack: ThemeMode): Theme {
  switch (pack) {
    case 'classic':
      return classicTheme;
    case 'sportTech':
      return sportTechTheme;
    case 'warmWellness':
      return warmWellnessTheme;
    default:
      return editorialTheme;
  }
}
