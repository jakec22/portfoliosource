// Fingerprint-based dedupe for statement re-imports. Claude re-reads the
// whole statement on every import — it has no memory of prior imports — so
// this is what lets a user upload an updated statement covering a wider date
// range (e.g. re-exporting "month to date" later in the month) without
// double-logging the transactions they already imported earlier.

import type { Entry } from '../types';
import type { ParsedTransaction } from './claudeImport';

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

function fingerprint(date: string, amountCents: number, note: string): string {
  return `${date}|${amountCents}|${normalize(note)}`;
}

/** True if a parsed transaction matches an entry already logged this month. */
export function isAlreadyImported(transaction: ParsedTransaction, existing: Entry[]): boolean {
  const target = fingerprint(transaction.date, transaction.amountCents, transaction.merchant);
  return existing.some((e) => fingerprint(e.date, e.amount, e.note) === target);
}
