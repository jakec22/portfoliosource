// Pure budget math. No React, no I/O — everything here is unit-tested in
// src/__tests__/budget.test.ts. Views must not re-derive any of this inline.

import type { Category, Entry, Phase, MonthRecord } from '../types';
import { PLAN } from '../data/seed';

/** The active cap for a category under the given phase, in cents. */
export function capFor(category: Category, phase: Phase): number {
  return phase === 2 ? category.phase2Cap : category.phase1Cap;
}

/** Sum of all category caps for a phase (total flexible budget), in cents. */
export function totalCap(categories: Category[], phase: Phase): number {
  return categories.reduce((sum, c) => sum + capFor(c, phase), 0);
}

/** Spent-by-category map, in cents. Ignores entries whose category is unknown. */
export function spentByCategory(entries: Entry[], categories: Category[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const c of categories) map[c.id] = 0;
  for (const e of entries) {
    if (map[e.categoryId] !== undefined) map[e.categoryId] += e.amount;
  }
  return map;
}

/** Total spent across all flexible categories, in cents. */
export function totalSpent(entries: Entry[], categories: Category[]): number {
  const byCat = spentByCategory(entries, categories);
  return Object.values(byCat).reduce((s, v) => s + v, 0);
}

export type CategoryStatus = 'ok' | 'near' | 'over';

export interface CategoryProgress {
  category: Category;
  cap: number; // cents
  spent: number; // cents
  /** Fraction of cap used, clamped to [0, 1] for bar width. */
  fraction: number;
  /** Signed remaining (negative when over cap), in cents. */
  remaining: number;
  status: CategoryStatus;
}

/** Per-category progress used to render the category rows. */
export function categoryProgress(
  category: Category,
  entries: Entry[],
  phase: Phase,
): CategoryProgress {
  const cap = capFor(category, phase);
  const spent = entries
    .filter((e) => e.categoryId === category.id)
    .reduce((s, e) => s + e.amount, 0);
  const remaining = cap - spent;
  // A zero cap that has any spend is immediately "over".
  const fraction = cap <= 0 ? (spent > 0 ? 1 : 0) : Math.min(spent / cap, 1);
  let status: CategoryStatus = 'ok';
  if (spent > cap) status = 'over';
  else if (cap > 0 && spent / cap > 0.85) status = 'near';
  return { category, cap, spent, fraction, remaining, status };
}

export interface Pace {
  /** Where the month marker sits, fraction in [0, 1]. */
  monthPct: number;
  /** Spend allowed by now to be exactly on pace, in cents. */
  paceTarget: number;
  /** Fraction of total cap spent, clamped to [0, 1] for the runway fill. */
  spendFraction: number;
  onPace: boolean;
}

/**
 * Runway pace: are we spending faster than the month is elapsing?
 * On pace when spend so far <= (total cap) * (fraction of month elapsed).
 */
export function computePace(
  totalSpentCents: number,
  totalCapCents: number,
  monthPct: number,
): Pace {
  const clampedMonth = Math.min(Math.max(monthPct, 0), 1);
  const paceTarget = Math.round(totalCapCents * clampedMonth);
  const spendFraction = totalCapCents <= 0 ? 0 : Math.min(totalSpentCents / totalCapCents, 1);
  return {
    monthPct: clampedMonth,
    paceTarget,
    spendFraction,
    onPace: totalSpentCents <= paceTarget,
  };
}

/**
 * Savings achieved for a completed month, in cents.
 *
 * Phase 2 targets $500 saved; Phase 1 targets breakeven ($0). In both cases
 * every dollar under the total cap adds to savings and every dollar over
 * subtracts. So:  savings = goal + (totalCap - totalSpent),
 * which is the spec's "500 - overage" / "500 + underspend" collapsed into one.
 */
export function savingsAchieved(
  phase: Phase,
  totalCapCents: number,
  totalSpentCents: number,
): number {
  const goal = phase === 2 ? PLAN.phase2SavingsGoal : 0;
  return goal + (totalCapCents - totalSpentCents);
}

/**
 * Roll the current month into history and start a fresh month.
 * Returns the archived record plus the empty entry list for the new month.
 * The prior month is snapshotted with the phase and caps it was actually run
 * under, so history stays accurate even after the active phase changes.
 */
export function rolloverMonth(
  currentMonth: string,
  phase: Phase,
  entries: Entry[],
  categories: Category[],
): { record: MonthRecord; nextEntries: Entry[] } {
  const cap = totalCap(categories, phase);
  const spent = totalSpent(entries, categories);
  const record: MonthRecord = {
    month: currentMonth,
    phase,
    totalCap: cap,
    totalSpent: spent,
    savings: savingsAchieved(phase, cap, spent),
    entries,
  };
  return { record, nextEntries: [] };
}
