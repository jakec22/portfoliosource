// Single source of truth for colors, type, and metrics.
//
// Design language: executive / sleek / monochromatic. A pure graphite
// (achromatic) palette — no hue anywhere. Status is conveyed by tone
// (brightness) and weight, not by color. Never hardcode a color at a call
// site — reference Colors.* instead.

export const Colors = {
  // Surfaces — near-black graphite, subtly cool.
  bg: '#0A0C10',
  surface: '#12151C',
  surfaceRaised: '#171B23',
  border: '#22262F',
  borderStrong: '#2E323C',
  headerBg: '#070A0E',

  // Text — platinum down to faint graphite.
  text: '#F3F5F9',
  textSecondary: '#A3A9B4',
  textMuted: '#6B7079',
  textFaint: '#474B53',

  // The only "accent" is light itself: near-white for active states and the
  // primary CTA, with a dark ink for text that sits on top of it.
  accent: '#F3F5F9',
  accentDim: '#C6CAD2',
  onAccent: '#070A0E',

  // Status via tone (grayscale only).
  // A bar/figure grows brighter as it fills toward its cap.
  toneOk: '#4C5159', // under cap: dim
  toneNear: '#8A8F99', // approaching cap: mid

  // The single permitted hue: a muted terracotta, used ONLY to signal
  // over-budget / over-cap (and negative savings / input error) states.
  // Everything else in the app stays achromatic.
  warning: '#C27A5B',

  // Runway fill gradients: calm & dim when on pace, bright when ahead of it.
  runwayOnPace: ['#2C3038', '#5A5F69'] as const,
  runwayAhead: ['#9297A1', '#F3F5F9'] as const,

  inputBg: '#070A0E',
  inputBorder: '#282C35',

  // Neutral background for the "goal" callout card.
  goalBg: '#12151C',
} as const;

export const Radii = {
  card: 12,
  bar: 3,
  runway: 6,
  button: 8,
} as const;

export const Metrics = {
  runwayHeight: 26,
  progressHeight: 6,
  maxWidth: 640,
  cardBorder: 1,
} as const;

// Type: sleek system grotesk (SF Pro on iOS), no rounded face. Large display
// figures use a light weight with tight tracking for an executive feel; every
// amount uses tabular lining figures so columns stay aligned (via the `mono`
// prop on AppText — tabular-nums on the same sans, not a typewriter face).
export const Type = {
  // Letter-spacing for large light headings/figures.
  displayTracking: -0.4,
  // Eyebrow / section-label tracking.
  eyebrowTracking: 2.5,
  weightLight: '300' as const,
  weightRegular: '400' as const,
  weightMedium: '500' as const,
  weightSemibold: '600' as const,
} as const;

// Animation timing for the runway/progress bars (respect Reduce Motion at call site).
export const BAR_ANIM_MS = 400;
