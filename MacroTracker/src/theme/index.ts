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
// expo-font. `fontDisplay` carries headlines and hero numerals; the
// `fontBody*` ladder carries labels and supporting copy.
//
// This module owns color and font *families* only. The sizes, line heights and
// tracking those families are set at live in ./tokens.ts, along with the
// spacing and radius scales — a pack changes personality, not proportion.
// Reach for `type.*(c)` from there rather than writing a bare `fontSize`:
// spreading one of those helpers is what actually applies the pack's font, and
// it is the reason the packs read as different products instead of one layout
// recolored.

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
  // The ladder runs regular → body → semi → bold. Four steps rather than two,
  // because a ramp with one weight for copy and one for everything emphatic
  // collapses subheads, strong body and section labels into a single rank.
  // Where a pack has no distinct semibold loaded, it doubles its bold; see the
  // per-pack notes.
  fontDisplay: string; // headlines and hero numerals
  fontBodyRegular: string; // long-form copy, muted captions
  fontBody: string; // body/labels at normal weight
  fontBodySemi: string; // subheads, section labels, emphasis inside copy
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

// Executive: the app's original, official look, now dark — warm near-black
// ground, one lifted green accent, restrained muted macro hues, serif display
// numerals. The default pack, and the one every other pack is judged against.
//
// The ground is #221F1B, which is the colour the watch app already paints
// behind this pack (see WATCH_GROUND in utils/watchPalette.ts). Deliberately
// not pure black: that is Modern's ground, and a warm near-black reads as a
// considered surface rather than a void. Phone and wrist now sit on the same
// black.
//
// Every value below was derived against that ground and checked, rather than
// inverted by eye. Two things a naive inversion gets wrong:
//
//   - The card has to move, not the ground. A card one step off #221F1B sits
//     at 1.1:1 and disappears; #36332E is 1.30:1, about the step iOS uses for
//     an elevated dark surface.
//   - The accent needs more lift here than on the watch. The watch lifts the
//     original #3F6B52 against the *ground*; on the phone it sits on *cards*,
//     which are lighter, so the same value drops to 4.0:1. Hence #6AA885.
//
// The macro hues are held to 3:1, not 4.5:1, because they are bar fills rather
// than text. Lifting all four to 4.5 put them at one luminance and they came
// out muddy and near-identical; at 3:1 they keep the light pack's character.
export const editorialTheme: Theme = {
  scheme: 'dark',

  bg: '#221F1B',
  card: '#36332E',
  cardMuted: '#2C2823',
  input: '#2C2823',

  text: '#F2EDE4',
  textMuted: '#A79D8F',
  textFaint: '#7A7268',

  border: '#45403A',
  borderStrong: '#5A544B',

  primary: '#6AA885',
  primaryDark: '#4E8365',
  primarySoft: 'rgba(106,168,133,0.16)',
  onPrimary: '#1A1714',
  danger: '#EF796C',
  dangerSoft: 'rgba(239,121,108,0.18)',
  warning: '#C19347',
  warningSoft: 'rgba(193,147,71,0.18)',
  info: '#869EAE',
  infoSoft: 'rgba(134,158,174,0.16)',
  accent: '#C58E7B',
  accentSoft: 'rgba(197,142,123,0.16)',

  // Two pairs needed separating after lifting, both found by checking every
  // pair rather than the ones expected to collide. Protein and fat landed 54
  // apart, and protein and carbs 58, against the 60 watchPalette enforces for
  // colours read side by side; fat moved to #A66F7C and carbs to #BA8C3D.
  //
  // danger and accent were the harder one. Executive's red and its terracotta
  // are near-neighbours in hue — only 52 apart even in the light pack — and
  // lifting both onto a dark ground closed that to 23. They sit side by side
  // as set-type badges on a workout (failure vs dropset), so that is not
  // survivable. Rather than bend the accent into a grey, danger became a
  // franker red: #D4877C was a washed salmon that read poorly as danger
  // anyway, and #EF796C is both clearer and 78 from the accent.
  macroProtein: '#B26950',
  macroCarbs: '#BA8C3D',
  macroFat: '#A66F7C',
  macroFiber: '#738067',

  hrZone1: '#57819B',
  hrZone2: '#74965C',
  hrZone3: '#C9A227',
  hrZone4: '#C4703A',
  hrZone5: '#D15248',

  shadow: '#000000',
  overlay: 'rgba(0,0,0,0.65)',

  fontDisplay: 'DMSerifDisplay_400Regular',
  fontBodyRegular: 'Manrope_400Regular',
  fontBody: 'Manrope_500Medium',
  fontBodySemi: 'Manrope_600SemiBold',
  fontBodyBold: 'Manrope_700Bold',

  // Inverted, as on every dark pack: gray900 is the strongest ink, which on a
  // dark ground is the lightest value.
  gray900: '#F2EDE4',
  gray700: '#D6CFC2',
  gray500: '#A79D8F',
  gray400: '#8A8075',
  gray300: '#5A544B',
  gray200: '#45403A',
  gray100: '#36332E',
  gray50: '#2C2823',
  white: '#36332E',
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

  // Space Grotesk has no lighter face loaded than 400, which suits this pack:
  // the sport-tech voice wants density, not air.
  //
  // The display face is Archivo Black, not Space Grotesk Bold. It used to be
  // the latter, which is also where the body ladder tops out — so a heading
  // and the bold text under it were the same face at two sizes, and this pack
  // separated from the others on color alone. Archivo Black is wide, flat-
  // sided and heavy where Space Grotesk is narrow and quirky, so the two read
  // as a pairing. It carries only a 400, which is all a display slot needs.
  fontDisplay: 'ArchivoBlack_400Regular',
  fontBodyRegular: 'SpaceGrotesk_400Regular',
  fontBody: 'SpaceGrotesk_500Medium',
  fontBodySemi: 'SpaceGrotesk_600SemiBold',
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

export function resolveTheme(pack: ThemeMode): Theme {
  switch (pack) {
    case 'sportTech':
      return sportTechTheme;
    default:
      return editorialTheme;
  }
}
