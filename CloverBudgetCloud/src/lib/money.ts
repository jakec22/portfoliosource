// Currency helpers. All amounts in the app are integer cents; these are the
// only functions that turn cents into displayable dollars.

/** "$1,234" — whole dollars, no cents. Used for caps/totals. */
export function fmtWhole(cents: number): string {
  const dollars = Math.round(cents / 100);
  return '$' + dollars.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/** "$1,234.56" — two decimals. Used for individual entries/spent figures. */
export function fmtCents(cents: number): string {
  const dollars = cents / 100;
  return '$' + dollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Parse free-text dollar input ("12", "12.5", "$12.50") into integer cents.
 * Returns null for anything non-positive or unparseable.
 */
export function parseDollarsToCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, '');
  if (cleaned === '') return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}
