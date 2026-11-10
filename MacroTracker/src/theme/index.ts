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
  /**
   * Third tier of text: captions, month labels, legend ends, placeholders,
   * disabled.
   *
   * Each pack sets it to clear 4.5:1 against the lightest surface it lands
   * on — Editorial's card, Sport-Tech's cardMuted — because nearly every use
   * is at 11 or 13pt, where that is the bar. It had been two steps darker and
   * measured 3.0:1 and 3.4:1 on those surfaces, which is where most of the
   * app's secondary copy lives.
   *
   * Hue and saturation are each pack's own; only lightness moved. Lifting
   * textMuted alongside it was tried and discarded: at the lightness that
   * keeps an even ladder it starts competing with primary text, flattening
   * the top of the hierarchy to fix the bottom. Weight already separates the
   * two tiers — muted is 500, faint is 400.
   */
  textFaint: string;

  // Lines
  border: string; // hairline border / divider
  borderStrong: string; // heavier border (e.g. outlined buttons)

  // Brand + semantic
  primary: string;
  primaryDark: string;
  /**
   * Tinted fills behind chips, badges and selected rows — opaque, not alpha.
   *
   * They used to be `rgba(...)`, which made every one of them legible or not
   * depending on what was behind it: the same "Completed" badge measured
   * 4.8:1 on the page background and 3.6:1 inside a card. Nine of the twenty
   * ink-on-fill pairings failed that way, and all of them failed on cards,
   * which is where chips actually live.
   *
   * Each is now frozen at what it already looked like on a card, so the app
   * is unchanged where these are most used and merely a shade lighter
   * elsewhere — and, more to the point, one value with one contrast figure
   * rather than a different one per surface.
   *
   * Six inks moved with them, a step lighter apiece, to clear 4.5:1 on their
   * own fill: primaryDark, danger, accent and info in Editorial, danger and
   * accent in Sport-Tech. Lighter ink on a dark app only adds contrast
   * everywhere else those tokens appear.
   */
  primarySoft: string;
  onPrimary: string; // text/icon sitting on a primary-colored surface
  danger: string;
  /**
   * Ink for text sitting directly on `danger`, the counterpart to onPrimary.
   *
   * It did not exist, so the three swipe-to-delete labels used '#fff' — which
   * measures 2.8:1 on Editorial's danger and 3.6:1 on Sport-Tech's. Both
   * dangers are light reds; white was always going to lose on them.
   */
  onDanger: string;
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

// Executive: the app's original, official look, now dark — a neutral
// near-black ground, saturated accents, serif display numerals. The default
// pack, and the one every other pack is judged against.
//
// The ground carries no colour cast on purpose. An earlier pass sat on
// #221F1B, the warm near-black the watch paints, which read brown and pulled
// every surface with it: the text was +14 red-over-blue and the cards +8.
// #0E0E10 is -2, so the terracotta and gold below read as chosen colours
// rather than as the ground showing through. The watch ground follows it (see
// WATCH_GROUND in utils/watchPalette.ts) so phone and wrist still match.
//
// Dark enough to let the accents be rich. This is the part that is easy to get
// backwards: the earlier pass looked washed because every accent had to clear
// 4.5:1 against lightish #36332E cards, and the only way up is lightness,
// which bleeds saturation. Dropping the ground buys headroom — #34C77B sits at
// 7.0:1 on the card here without being lightened at all.
//
// Two measurements that do not survive being eyeballed:
//
//   - Cards need a proportionally bigger step at near-black. #0E0E10 to
//     #1A1A1D is 1.11:1 and invisible; #252527 is 1.26:1.
//   - Macro hues are held to 3:1, not 4.5:1, because bar fills are graphics
//     rather than text. At 4.5 all four land on one luminance and go muddy.
//
// accent and macroProtein are deliberately one colour, as are warning and
// macroCarbs — that pairing is inherited from the light pack.
export const editorialTheme: Theme = {
  scheme: 'dark',

  bg: '#0E0E10',
  card: '#252527',
  cardMuted: '#1A1A1C',
  input: '#1A1A1C',

  text: '#F4F4F5',
  textMuted: '#A1A1A8',
  textFaint: '#8C8C94',

  border: '#34343A',
  borderStrong: '#47474F',

  primary: '#34C77B',
  primaryDark: '#2CBC70',
  primarySoft: '#273F34',
  onPrimary: '#07140D',
  danger: '#F5827B',
  onDanger: '#1E0403',
  dangerSoft: '#4A3334',
  warning: '#E0A32E',
  warningSoft: '#473C28',
  info: '#68A7D8',
  infoSoft: '#2D3943',
  accent: '#E7835E',
  accentSoft: '#43302A',

  macroProtein: '#E2683C',
  macroCarbs: '#E0A32E',
  macroFat: '#D1699B',
  macroFiber: '#79C993',

  hrZone1: '#5A9FD4',
  hrZone2: '#79C993',
  hrZone3: '#E0A32E',
  hrZone4: '#E2683C',
  hrZone5: '#F4756D',

  shadow: '#000000',
  overlay: 'rgba(0,0,0,0.7)',

  fontDisplay: 'DMSerifDisplay_400Regular',
  fontBodyRegular: 'Manrope_400Regular',
  fontBody: 'Manrope_500Medium',
  fontBodySemi: 'Manrope_600SemiBold',
  fontBodyBold: 'Manrope_700Bold',

  // Inverted, as on every dark pack: gray900 is the strongest ink, which on a
  // dark ground is the lightest value.
  gray900: '#F4F4F5',
  gray700: '#D2D2D7',
  gray500: '#A1A1A8',
  gray400: '#85858D',
  gray300: '#47474F',
  gray200: '#34343A',
  gray100: '#252527',
  gray50: '#1A1A1C',
  white: '#252527',
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
  textFaint: '#828D9A',

  border: '#262C37',
  borderStrong: '#343B48',

  primary: '#C9F04D',
  primaryDark: '#A8CC3A',
  primarySoft: '#333D2A',
  onPrimary: '#0D1017',
  danger: '#F46081',
  onDanger: '#140407',
  dangerSoft: '#3E2330',
  warning: '#FBBF24',
  warningSoft: '#403923',
  info: '#22D3EE',
  infoSoft: '#193843',
  accent: '#F4569C',
  accentSoft: '#3A2134',

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
