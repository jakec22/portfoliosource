import type { Theme } from '../theme';

/**
 * Minimum contrast a color must have against the watch's black background.
 *
 * The packs were designed for the phone's surfaces — Executive's deep green
 * sits at 3.4:1 on black, which is legible but noticeably dimmer than the
 * watch's previous hardcoded green (8.3:1). That matters on a wrist glanced at
 * mid-set in daylight, so colors below this are lifted for the watch only.
 */
const MIN_CONTRAST_ON_BLACK = 4.5;

/**
 * Against pure black, contrast simplifies to (L + 0.05) / 0.05, so the
 * required relative luminance is a constant rather than a search over pairs.
 */
const MIN_LUMINANCE = MIN_CONTRAST_ON_BLACK * 0.05 - 0.05;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const to = (v: number) =>
    Math.round(Math.max(0, Math.min(1, v)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
}

function relativeLuminance(r: number, g: number, b: number): number {
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return [channel(h + 1 / 3), channel(h), channel(h - 1 / 3)];
}

/**
 * Raise a color's lightness until it clears the contrast floor against black,
 * keeping hue and saturation so the pack still reads as itself. Colors already
 * above the floor are returned untouched.
 */
export function liftForBlack(hex: string, minLuminance = MIN_LUMINANCE): string {
  const [r, g, b] = hexToRgb(hex);
  if (relativeLuminance(r, g, b) >= minLuminance) return hex.toUpperCase();

  const [h, s] = rgbToHsl(r, g, b);
  // Binary search the lightness that just clears the floor — monotonic in L,
  // so ~20 iterations lands well inside a single 8-bit step.
  let lo = rgbToHsl(r, g, b)[2];
  let hi = 1;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    const [mr, mg, mb] = hslToRgb(h, s, mid);
    if (relativeLuminance(mr, mg, mb) >= minLuminance) hi = mid;
    else lo = mid;
  }
  const [fr, fg, fb] = hslToRgb(h, s, hi);
  return rgbToHex(fr, fg, fb);
}

/** Colors the watch renders with, mirrored from the active pack. */
export interface WatchPalette {
  accent: string;
  protein: string;
  carbs: string;
  fat: string;
  water: string;
  zoneEasy: string;
  zoneMid: string;
  zoneHigh: string;
}

/**
 * The active pack's accents, adjusted for a permanently black screen.
 *
 * Only the accents travel: the watch keeps its black background whatever the
 * pack, because OLED black is what watchOS expects and what preserves battery
 * — a cream surface from the Executive pack would be wrong on a wrist.
 */
export function watchPalette(c: Theme): WatchPalette {
  return {
    accent: liftForBlack(c.primary),
    protein: liftForBlack(c.macroProtein),
    carbs: liftForBlack(c.macroCarbs),
    fat: liftForBlack(c.macroFat),
    water: liftForBlack(c.info),
    zoneEasy: liftForBlack(c.hrZone2),
    zoneMid: liftForBlack(c.hrZone3),
    zoneHigh: liftForBlack(c.hrZone5),
  };
}
