import type { Theme } from '../theme';
import type { ThemeMode } from '../types';

/**
 * The surface each pack renders on.
 *
 * Not the pack's own background — the watch stays dark whatever the pack, for
 * OLED battery and because watchOS has no light mode to follow. Executive's
 * warm near-black reads as a considered surface rather than a void, and it
 * flatters Wellness better than Wellness's own ground does: that pack's
 * surface and accent tones share a hue family, so its own brown makes the
 * terracotta ring compete with its background. Modern keeps pure black, where
 * its neon accents already sit at 5-16:1.
 */
export const WATCH_GROUND: Record<ThemeMode, string> = {
  editorial: '#221F1B',
  warmWellness: '#221F1B',
  sportTech: '#000000',
};

/**
 * Minimum contrast a color must have against the watch's background.
 *
 * The packs were designed for the phone's surfaces — Executive's deep green
 * sits at 3.4:1 on black, which is legible but noticeably dimmer than the
 * watch's previous hardcoded green (8.3:1). That matters on a wrist glanced at
 * mid-set in daylight, so colors below this are lifted for the watch only.
 */
const MIN_CONTRAST = 4.5;

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

function contrast(a: string, b: string): number {
  const la = relativeLuminance(...hexToRgb(a));
  const lb = relativeLuminance(...hexToRgb(b));
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Raise a color's lightness until it clears the contrast floor against the
 * given background, keeping hue and saturation so the pack still reads as
 * itself. Colors already above the floor are returned untouched.
 */
export function liftForGround(hex: string, ground: string, minContrast = MIN_CONTRAST): string {
  if (contrast(hex, ground) >= minContrast) return hex.toUpperCase();

  const [r, g, b] = hexToRgb(hex);
  const [h, s, startL] = rgbToHsl(r, g, b);
  // Contrast against a fixed dark ground rises monotonically with lightness,
  // so a binary search lands well inside a single 8-bit step in ~20 passes.
  let lo = startL;
  let hi = 1;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    const candidate = rgbToHex(...hslToRgb(h, s, mid));
    if (contrast(candidate, ground) >= minContrast) hi = mid;
    else lo = mid;
  }
  return rgbToHex(...hslToRgb(h, s, hi));
}

/**
 * How far apart, as plain RGB distance, the stop button has to sit from the
 * pause button beside it.
 *
 * Contrast against the background isn't the property that matters for a pair
 * of adjacent controls — both clear 4.5:1 and still look the same. Wellness is
 * the case that forced this: its danger lifts to #CC6969 and its accent to
 * #C66F4D, which differ by 29, almost entirely in the blue channel. Two
 * warm mid-tones, side by side, one of which ends the workout.
 */
const MIN_ACCENT_SEPARATION = 60;

function rgbDistance(a: string, b: string): number {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return Math.hypot((r1 - r2) * 255, (g1 - g2) * 255, (b1 - b2) * 255);
}

/**
 * The pack's destructive color, made unmistakable next to its accent.
 *
 * Packs whose danger already reads as its own color are returned untouched
 * (Executive sits 124 away, Modern 178). Only when the two would be confusable
 * is the hue pulled to pure red and saturated — the direction a stop control
 * should move in anyway — searching saturation then lightness for the first
 * candidate that clears both the separation and the contrast floor.
 */
export function dangerForGround(hex: string, ground: string, accent: string): string {
  const lifted = liftForGround(hex, ground);
  if (rgbDistance(lifted, accent) >= MIN_ACCENT_SEPARATION) return lifted;

  const [, , baseL] = rgbToHsl(...hexToRgb(lifted));
  for (const s of [0.6, 0.68, 0.75, 0.82, 0.9]) {
    for (const dl of [0, 0.04, -0.04, 0.08, -0.08]) {
      const l = Math.max(0.2, Math.min(0.8, baseL + dl));
      const candidate = liftForGround(rgbToHex(...hslToRgb(0, s, l)), ground);
      if (rgbDistance(candidate, accent) >= MIN_ACCENT_SEPARATION) return candidate;
    }
  }
  // Nothing cleared the bar — the lifted pack color still beats a color that
  // fails the contrast floor.
  return lifted;
}

/** Colors the watch renders with, mirrored from the active pack. */
export interface WatchPalette {
  /** Background the watch paints, per pack. */
  ground: string;
  accent: string;
  /**
   * Destructive actions — the workout's stop button.
   *
   * It has to travel with the pack rather than leaning on SwiftUI's
   * `role: .destructive`: the watch sets a tint on the whole view hierarchy so
   * the controls watchOS draws for us follow the theme, and that tint wins
   * over the role, which turned the stop button the same green as pause.
   */
  danger: string;
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
export function watchPalette(c: Theme, mode: ThemeMode): WatchPalette {
  const ground = WATCH_GROUND[mode] ?? '#000000';
  const lift = (hex: string) => liftForGround(hex, ground);
  const accent = lift(c.primary);
  return {
    ground,
    accent,
    danger: dangerForGround(c.danger, ground, accent),
    protein: lift(c.macroProtein),
    carbs: lift(c.macroCarbs),
    fat: lift(c.macroFat),
    water: lift(c.info),
    zoneEasy: lift(c.hrZone2),
    zoneMid: lift(c.hrZone3),
    zoneHigh: lift(c.hrZone5),
  };
}
