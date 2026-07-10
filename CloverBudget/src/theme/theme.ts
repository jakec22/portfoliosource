// Single source of truth for colors, type, and metrics.
// Hex values come verbatim from PROJECT_SPEC.md DESIGN. Never hardcode a color
// at a call site — reference Theme.* instead.

export const Colors = {
  bg: '#10151F',
  surface: '#161D2A',
  border: '#232B3A',
  headerBg: '#0B0F16',

  text: '#E8EBF0',
  textSecondary: '#B9C1D0',
  textMuted: '#8A93A6',
  textFaint: '#69738A',

  // Accent green (success / on-pace / CTA)
  green: '#5FD4A8',
  greenDark: '#2E8C6A',

  amber: '#E8B44F',

  red: '#F0647A',
  redDark: '#B03A50',

  inputBg: '#0B0F16',
  inputBorder: '#2C3547',

  // Tinted background for the "goal" callout card.
  goalBg: '#14251F',
} as const;

export const Radii = {
  card: 10,
  bar: 4,
  runway: 6,
  button: 8,
} as const;

export const Metrics = {
  runwayHeight: 26,
  progressHeight: 8,
  maxWidth: 640,
  cardBorder: 1,
} as const;

// SF Pro Rounded is the system rounded face on iOS; on web/Android react-native
// falls back to the platform system font. Numbers use a monospaced face so
// figures stay tabular, matching the web app's IBM Plex Mono.
export const Fonts = {
  ui: undefined as string | undefined, // system rounded is applied per-platform below
  monoWeight: '600' as const,
} as const;

// Animation timing for the runway/progress bars (respect Reduce Motion at call site).
export const BAR_ANIM_MS = 400;
