import type { Theme } from '../theme';
import type { UserProfile } from '../types';

export interface HeartRateZone {
  /** 1–5, ascending intensity. */
  index: 1 | 2 | 3 | 4 | 5;
  name: string;
  /** Lower bound as a fraction of max HR (inclusive). */
  from: number;
  /** Upper bound as a fraction of max HR (exclusive, except zone 5). */
  to: number;
}

// Standard five-zone model as a percentage of max heart rate. Zone 5 is
// open-ended at the top so anything above 100% of the estimate still lands
// somewhere rather than falling off the scale.
export const HR_ZONES: HeartRateZone[] = [
  { index: 1, name: 'Recovery', from: 0, to: 0.6 },
  { index: 2, name: 'Easy', from: 0.6, to: 0.7 },
  { index: 3, name: 'Aerobic', from: 0.7, to: 0.8 },
  { index: 4, name: 'Threshold', from: 0.8, to: 0.9 },
  { index: 5, name: 'Max', from: 0.9, to: Infinity },
];

// Fallback used when there's no profile age to estimate from. Chosen so the
// zone edges land on the thresholds the app already used before zones existed
// (120 moderate / 160 high), keeping colors familiar for existing users.
const FALLBACK_MAX_HR = 190;

/** Estimated max heart rate. Uses the classic 220 − age when age is known. */
export function maxHeartRate(profile?: UserProfile): number {
  const age = profile?.age;
  if (!age || age <= 0 || age > 120) return FALLBACK_MAX_HR;
  return 220 - age;
}

/** Which zone a bpm reading falls into, given an estimated max. */
export function zoneForBpm(bpm: number, maxHr: number): HeartRateZone {
  const pct = maxHr > 0 ? bpm / maxHr : 0;
  // Walk down so the open-ended top zone wins for anything at or above 90%.
  for (let i = HR_ZONES.length - 1; i >= 0; i--) {
    if (pct >= HR_ZONES[i].from) return HR_ZONES[i];
  }
  return HR_ZONES[0];
}

/** The theme color for a zone. Kept here so every HR surface agrees. */
export function zoneColor(zone: HeartRateZone, c: Theme): string {
  switch (zone.index) {
    case 1:
      return c.hrZone1;
    case 2:
      return c.hrZone2;
    case 3:
      return c.hrZone3;
    case 4:
      return c.hrZone4;
    default:
      return c.hrZone5;
  }
}

/** Convenience: color straight from a bpm reading. */
export function colorForBpm(bpm: number, maxHr: number, c: Theme): string {
  return zoneColor(zoneForBpm(bpm, maxHr), c);
}

/** The bpm range a zone covers, for axis labels and legends. */
export function zoneBounds(zone: HeartRateZone, maxHr: number): { lo: number; hi: number | null } {
  return {
    lo: Math.round(zone.from * maxHr),
    hi: Number.isFinite(zone.to) ? Math.round(zone.to * maxHr) : null,
  };
}

/**
 * Time spent in each zone, in milliseconds. Each sample is credited with the
 * gap until the next one, so uneven sampling (the watch streams irregularly)
 * doesn't skew the distribution toward densely-sampled stretches.
 */
export function timeInZones(
  samples: { bpm: number; timestamp: number }[],
  maxHr: number
): number[] {
  const out = [0, 0, 0, 0, 0];
  if (samples.length < 2) return out;
  for (let i = 0; i < samples.length - 1; i++) {
    const dt = samples[i + 1].timestamp - samples[i].timestamp;
    if (dt <= 0) continue;
    // Ignore implausible gaps (app backgrounded, watch dropped out) rather
    // than attributing minutes of silence to whatever zone preceded them.
    if (dt > 60_000) continue;
    out[zoneForBpm(samples[i].bpm, maxHr).index - 1] += dt;
  }
  return out;
}
