import { parseResponseJson, ImportError } from '../lib/claudeImport';
import { isAlreadyImported } from '../lib/importDedupe';
import type { Entry } from '../types';

function apiResponse(transactions: unknown[]) {
  return { content: [{ type: 'text', text: JSON.stringify({ transactions }) }] };
}

describe('parseResponseJson', () => {
  test('maps valid transactions and converts dollars to cents', () => {
    const result = parseResponseJson(
      apiResponse([
        { date: '2026-07-03', merchant: 'Costco', amount: 142.5, categoryId: 'groceries' },
        { date: '2026-07-05', merchant: 'Dutch Bros', amount: 6, categoryId: 'dining' },
      ]),
    );
    expect(result).toEqual([
      { date: '2026-07-03', merchant: 'Costco', amountCents: 14250, categoryId: 'groceries' },
      { date: '2026-07-05', merchant: 'Dutch Bros', amountCents: 600, categoryId: 'dining' },
    ]);
  });

  test('falls back to misc for an unknown category id', () => {
    const [row] = parseResponseJson(
      apiResponse([{ date: '2026-07-01', merchant: 'Widget Co', amount: 10, categoryId: 'not-a-real-category' }]),
    );
    expect(row.categoryId).toBe('misc');
  });

  test('skips malformed rows instead of failing the whole import', () => {
    const result = parseResponseJson(
      apiResponse([
        { date: '2026-07-01', merchant: 'Good Row', amount: 5, categoryId: 'misc' },
        { date: '2026-07-01', merchant: 'Zero amount', amount: 0, categoryId: 'misc' },
        { date: '2026-07-01', merchant: 'Negative', amount: -5, categoryId: 'misc' },
        { date: '2026-07-01', amount: 5, categoryId: 'misc' }, // missing merchant
        'not even an object',
      ]),
    );
    expect(result).toHaveLength(1);
    expect(result[0].merchant).toBe('Good Row');
  });

  test('trims whitespace on merchant text', () => {
    const [row] = parseResponseJson(
      apiResponse([{ date: '2026-07-01', merchant: '  Spaces Inc  ', amount: 1, categoryId: 'misc' }]),
    );
    expect(row.merchant).toBe('Spaces Inc');
  });

  test('throws when the model refuses', () => {
    expect(() => parseResponseJson({ stop_reason: 'refusal', content: [] })).toThrow(ImportError);
  });

  test('throws when there is no text block', () => {
    expect(() => parseResponseJson({ content: [{ type: 'thinking' }] })).toThrow(ImportError);
  });

  test('throws on unparseable JSON text', () => {
    expect(() => parseResponseJson({ content: [{ type: 'text', text: 'not json' }] })).toThrow(ImportError);
  });

  test('treats a missing transactions array as empty, not an error', () => {
    expect(parseResponseJson({ content: [{ type: 'text', text: '{}' }] })).toEqual([]);
  });
});

describe('isAlreadyImported', () => {
  const entry = (over: Partial<Entry> = {}): Entry => ({
    id: 'e1',
    categoryId: 'dining',
    amount: 600,
    note: 'Dutch Bros',
    date: '2026-07-05',
    ...over,
  });

  test('matches an identical date + amount + note', () => {
    const t = { date: '2026-07-05', merchant: 'Dutch Bros', amountCents: 600, categoryId: 'dining' };
    expect(isAlreadyImported(t, [entry()])).toBe(true);
  });

  test('matches case- and whitespace-insensitively', () => {
    const t = { date: '2026-07-05', merchant: '  dutch   bros  ', amountCents: 600, categoryId: 'dining' };
    expect(isAlreadyImported(t, [entry()])).toBe(true);
  });

  test('does not match a different amount', () => {
    const t = { date: '2026-07-05', merchant: 'Dutch Bros', amountCents: 700, categoryId: 'dining' };
    expect(isAlreadyImported(t, [entry()])).toBe(false);
  });

  test('does not match a different date', () => {
    const t = { date: '2026-07-06', merchant: 'Dutch Bros', amountCents: 600, categoryId: 'dining' };
    expect(isAlreadyImported(t, [entry()])).toBe(false);
  });

  test('does not match different merchant text', () => {
    const t = { date: '2026-07-05', merchant: 'Kona Loa', amountCents: 600, categoryId: 'dining' };
    expect(isAlreadyImported(t, [entry()])).toBe(false);
  });

  test('is false against an empty existing list (first import of the month)', () => {
    const t = { date: '2026-07-05', merchant: 'Dutch Bros', amountCents: 600, categoryId: 'dining' };
    expect(isAlreadyImported(t, [])).toBe(false);
  });

  test('re-import scenario: only the newer transaction is treated as new', () => {
    // First import already logged the July 5 purchase.
    const alreadyLogged = [entry()];
    // Second, fuller statement covers the same July 5 purchase plus a new one on July 9.
    const reparsed = [
      { date: '2026-07-05', merchant: 'Dutch Bros', amountCents: 600, categoryId: 'dining' },
      { date: '2026-07-09', merchant: 'Trader Joes', amountCents: 4820, categoryId: 'groceries' },
    ];
    const flags = reparsed.map((t) => isAlreadyImported(t, alreadyLogged));
    expect(flags).toEqual([true, false]);
  });
});
