import { Food, ServingUnit } from '../types';

const GRAMS_PER_OZ = 28.3495;
const ML_PER_FL_OZ = 29.5735;

function isVolume(food: Food): boolean {
  return food.serving_unit === 'ml';
}

/**
 * Units offered for a food, based on whether its base serving is mass or
 * volume. "serving" is always available.
 */
export function availableUnits(food: Food): ServingUnit[] {
  if (isVolume(food)) return ['serving', 'fl oz', 'ml'];
  // Default to mass-based foods (grams).
  return ['serving', 'g', 'oz'];
}

/** A sensible default amount when switching to a given unit. */
export function defaultAmount(food: Food, unit: ServingUnit): number {
  switch (unit) {
    case 'serving':
      return 1;
    case 'g':
    case 'ml':
      return food.serving_size;
    case 'oz':
      return Math.round((food.serving_size / GRAMS_PER_OZ) * 10) / 10;
    case 'fl oz':
      return Math.round((food.serving_size / ML_PER_FL_OZ) * 10) / 10;
  }
}

/**
 * Convert an entered amount+unit into the macro multiplier (relative to the
 * food's base serving_size).
 */
export function toMultiplier(food: Food, amount: number, unit: ServingUnit): number {
  if (!amount || amount <= 0 || food.serving_size <= 0) return 0;
  switch (unit) {
    case 'serving':
      return amount;
    case 'g':
    case 'ml':
      return amount / food.serving_size;
    case 'oz':
      return (amount * GRAMS_PER_OZ) / food.serving_size;
    case 'fl oz':
      return (amount * ML_PER_FL_OZ) / food.serving_size;
  }
}

/** Human-readable amount label for a logged entry. */
export function formatAmount(entry: { amount?: number; unit?: ServingUnit; servings: number; food: Food }): string {
  const { amount, unit, servings, food } = entry;
  if (amount != null && unit) {
    if (unit === 'serving') {
      return `${trim(amount)} serving${amount === 1 ? '' : 's'}`;
    }
    return `${trim(amount)} ${unit}`;
  }
  // Legacy entries logged before unit support.
  return `${trim(servings)} × ${food.serving_size}${food.serving_unit}`;
}

function trim(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}
