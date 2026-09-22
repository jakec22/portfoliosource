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
// expo-font. `fontDisplay` carries headlines and hero numerals; `fontBody` /
// `fontBodyBold` carry labels and supporting copy. Applying them is what makes
// the packs read as different products rather than one layout recolored, so
// screens should reach for them rather than falling back to the system face.

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

  // Heart-rate training zones 1–5, cool (recovery) → hot (max effort). Tuned
  // per pack rather than hardcoded in the chart: the ramp has to stay ordered
  // and legible in each pack's own palette, the same way the macro hues do.
  hrZone1: string;
  hrZone2: string;
  hrZone3: string;
  hrZone4: string;
  hrZone5: string;

  // Misc
  shadow: string;
  overlay: string; // modal scrim

  // Custom font families for this pack (registered names — see App.tsx).
  //
  // iOS does not synthesize weights for custom families: pairing fontBody with
  // fontWeight:'700' renders at the family's own weight, not bold. So weight is
  // selected by picking the family, and styles that set one of these should not
  // also set fontWeight.
  fontDisplay: string; // headlines and hero numerals
  fontBody: string; // body/labels at normal weight
  fontBodyBold: string; // body/labels at bold weight

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

// Executive: the app's original, official look — warm neutrals, one deep-green
// accent, restrained muted hues for the macro rings, serif display numerals.
// The default pack, and the one every other pack is judged against.
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

  hrZone1: '#4A6E85',
  hrZone2: '#74965C',
  hrZone3: '#C9A227',
  hrZone4: '#C4703A',
  hrZone5: '#A8342A',

  shadow: '#000000',
  overlay: 'rgba(0,0,0,0.5)',

  fontDisplay: 'DMSerifDisplay_400Regular',
  fontBody: 'Manrope_500Medium',
  fontBodyBold: 'Manrope_700Bold',

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

  hrZone1: '#38BDF8',
  hrZone2: '#C9F04D',
  hrZone3: '#FBBF24',
  hrZone4: '#FB923C',
  hrZone5: '#F2456B',

  shadow: '#000000',
  overlay: 'rgba(0,0,0,0.65)',

  fontDisplay: 'SpaceGrotesk_700Bold',
  fontBody: 'SpaceGrotesk_500Medium',
  fontBodyBold: 'SpaceGrotesk_700Bold',

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

  hrZone1: '#5E8FA8',
  hrZone2: '#7A9A6E',
  hrZone3: '#D6A03E',
  hrZone4: '#D2722F',
  hrZone5: '#B03636',

  shadow: '#7A4B2E',
  overlay: 'rgba(59,46,36,0.5)',

  fontDisplay: 'BricolageGrotesque_700Bold',
  fontBody: 'NunitoSans_500Medium',
  fontBodyBold: 'NunitoSans_700Bold',

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
    case 'sportTech':
      return sportTechTheme;
    case 'warmWellness':
      return warmWellnessTheme;
    default:
      return editorialTheme;
  }
}
