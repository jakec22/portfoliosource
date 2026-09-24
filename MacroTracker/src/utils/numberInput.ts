// Text-field helpers for the numeric set fields (weight, reps).

/**
 * Strip anything that isn't a digit or a decimal point, keeping only the first
 * point.
 *
 * Why a string and not a number: a weight field has to survive the moment the
 * user has typed "12." and nothing after it. Round-tripping through
 * parseFloat drops the trailing dot, the field re-renders as "12", and the
 * next keystroke lands as "125" — a decimal could never actually be entered.
 * Callers hold the raw text while editing and parse on commit.
 */
export function sanitizeDecimal(v: string): string {
  let cleaned = v.replace(/[^0-9.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot !== -1) {
    cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
  }
  return cleaned;
}

/** Digits only — reps and other whole-number fields. */
export function sanitizeInteger(v: string): string {
  return v.replace(/[^0-9]/g, '');
}
