// Pack-independent scales: type ramp, spacing, radii, elevation.
//
// The theme packs in ./index.ts own color and font *families*. This file owns
// the measurements those families are set at, and the rhythm the layout is
// built on. Splitting it that way is deliberate: a pack changes personality,
// not proportion, so Executive and Modern share one ramp and one grid.
//
// Why this exists: the screens were styled locally, screen by screen, and had
// drifted to 21 distinct `fontSize` values, 18 `borderRadius` values, 21
// padding values and 10 `gap` values. Those aren't a style, they're the
// absence of one — inconsistent rhythm reads as low quality before anyone can
// name why, and with no scale every new screen re-decides from scratch.
//
// How to use it. The app builds styles with a `makeStyles(c)` factory, so the
// ramp is exposed as spreadable style objects rather than components:
//
//   const makeStyles = (c: Theme) => StyleSheet.create({
//     title: { ...type.title(c), color: c.text },
//     label: { ...type.overline(c), color: c.textMuted },
//     card:  { padding: space.lg, borderRadius: radius.card },
//   });
//
// Spreading a `type.*` helper is what actually applies the pack's font. 357 of
// 419 text styles used to declare no `fontFamily` at all, which is why
// switching packs changed hues and almost nothing else. Set the family by
// picking the variant; never pair one with `fontWeight` (see the note on
// weights in ./index.ts).

import type { Theme } from './index';

// ---------------------------------------------------------------------------
// Spacing
// ---------------------------------------------------------------------------

// A 4-based scale. Every padding, margin and gap comes from here.
// `xxs` exists because hairline insets inside progress tracks genuinely need
// 2px and rounding them to 4 doubles them; it is not a general-purpose step.
export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

// ---------------------------------------------------------------------------
// Radii
// ---------------------------------------------------------------------------

// Five values, each tied to a kind of surface rather than a number someone
// liked. `hairline` is for bars and tracks a few pixels tall, where `control`
// would read as a lozenge.
export const radius = {
  hairline: 3,
  control: 10, // buttons, chips, inputs, steppers
  card: 16, // cards, rows, list items
  sheet: 24, // modals, bottom sheets, full-bleed panels
  pill: 999, // avatars, badges, fully-round controls
} as const;

// ---------------------------------------------------------------------------
// Type ramp
// ---------------------------------------------------------------------------

// Seven sizes, ratio ~1.2, so adjacent steps are visibly different. A 2px step
// is not a hierarchy; it reads as a mistake.
export const fontSize = {
  micro: 11,
  caption: 13,
  body: 15,
  subhead: 18,
  heading: 22,
  title: 28,
  hero: 40,
} as const;

// Display sizes sit near 1.15× their size, body text near 1.45×. Tracking
// tightens as size grows and opens up for all-caps, where the default spacing
// of capitals is too tight to read.
interface TextStyle {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
  textTransform?: 'uppercase';
}

// Display tier — the pack's `fontDisplay`. Headlines and hero numerals only;
// used on body copy it stops reading as a voice and starts reading as noise.
const hero = (c: Theme): TextStyle => ({
  fontFamily: c.fontDisplay,
  fontSize: fontSize.hero,
  lineHeight: 44,
  letterSpacing: -1,
});

const title = (c: Theme): TextStyle => ({
  fontFamily: c.fontDisplay,
  fontSize: fontSize.title,
  lineHeight: 34,
  letterSpacing: -0.5,
});

const heading = (c: Theme): TextStyle => ({
  fontFamily: c.fontDisplay,
  fontSize: fontSize.heading,
  lineHeight: 28,
  letterSpacing: -0.3,
});

// Body tier — the pack's body families, weight chosen by family.
const subhead = (c: Theme): TextStyle => ({
  fontFamily: c.fontBodySemi,
  fontSize: fontSize.subhead,
  lineHeight: 24,
  letterSpacing: -0.2,
});

const body = (c: Theme): TextStyle => ({
  fontFamily: c.fontBodyRegular,
  fontSize: fontSize.body,
  lineHeight: 22,
});

const bodyStrong = (c: Theme): TextStyle => ({
  fontFamily: c.fontBodyBold,
  fontSize: fontSize.body,
  lineHeight: 22,
});

const caption = (c: Theme): TextStyle => ({
  fontFamily: c.fontBodyRegular,
  fontSize: fontSize.caption,
  lineHeight: 18,
});

const captionStrong = (c: Theme): TextStyle => ({
  fontFamily: c.fontBodySemi,
  fontSize: fontSize.caption,
  lineHeight: 18,
});

// The one treatment for section titles. They had been rendering at 13, 18 and
// 20 in different places, so the same rank of information looked like three
// different ranks.
const overline = (c: Theme): TextStyle => ({
  fontFamily: c.fontBodySemi,
  fontSize: fontSize.micro,
  lineHeight: 14,
  letterSpacing: 0.8,
  textTransform: 'uppercase',
});

const micro = (c: Theme): TextStyle => ({
  fontFamily: c.fontBodyRegular,
  fontSize: fontSize.micro,
  lineHeight: 15,
});

export const type = {
  hero,
  title,
  heading,
  subhead,
  body,
  bodyStrong,
  caption,
  captionStrong,
  overline,
  micro,
} as const;

export type TypeVariant = keyof typeof type;

// ---------------------------------------------------------------------------
// Numerals
// ---------------------------------------------------------------------------

// Proportional figures make a column of numbers jitter as the values change,
// which is most of what this app displays. Spread this onto any style whose
// value updates in place or sits in a column: weights, reps, macro readouts,
// timers, table cells.
//
//   readout: { ...type.bodyStrong(c), ...tabular, color: c.text },
export const tabular = {
  fontVariant: ['tabular-nums' as const],
};

// ---------------------------------------------------------------------------
// Elevation
// ---------------------------------------------------------------------------

// Shadows carry an offset and a soft blur; a zero-offset halo is decoration,
// not depth. `shadowColor` comes from the pack, because a neutral black shadow
// over the warm packs' cream grounds goes gray and dirty.
export const elevation = {
  card: (c: Theme) => ({
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: c.scheme === 'dark' ? 0.4 : 0.06,
    shadowRadius: 3,
    elevation: 2,
  }),
  sheet: (c: Theme) => ({
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: c.scheme === 'dark' ? 0.55 : 0.12,
    shadowRadius: 16,
    elevation: 12,
  }),
} as const;

// ---------------------------------------------------------------------------
// Touch targets
// ---------------------------------------------------------------------------

// Apple asks for 44pt, Android for 48dp. Controls may look smaller than this —
// pass the difference to `hitSlop` so density survives without the target
// shrinking with it.
export const MIN_TOUCH = 44;
