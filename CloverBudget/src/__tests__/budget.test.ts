import {
  capFor,
  totalCap,
  spentByCategory,
  totalSpent,
  categoryProgress,
  computePace,
  savingsAchieved,
  rolloverMonth,
} from '../lib/budget';
import { parseDollarsToCents, fmtWhole, fmtCents } from '../lib/money';
import { monthKey, isoDate, monthPosition, monthLabel } from '../lib/dates';
import { CATEGORIES, PLAN } from '../data/seed';
import type { Entry } from '../types';

const c = (d: number) => Math.round(d * 100);

const entry = (categoryId: string, dollars: number, date = '2026-07-05'): Entry => ({
  id: `${categoryId}-${dollars}-${Math.random()}`,
  categoryId,
  amount: c(dollars),
  note: '',
  date,
});

describe('cap math', () => {
  test('capFor returns the phase-specific cap', () => {
    const dining = CATEGORIES.find((x) => x.id === 'dining')!;
    expect(capFor(dining, 1)).toBe(c(200));
    expect(capFor(dining, 2)).toBe(c(100));
  });

  test('total caps match the plan phases exactly', () => {
    expect(totalCap(CATEGORIES, 1)).toBe(c(2390));
    expect(totalCap(CATEGORIES, 2)).toBe(c(1890));
  });

  test('phase 2 flexible budget is $500 tighter than phase 1', () => {
    expect(totalCap(CATEGORIES, 1) - totalCap(CATEGORIES, 2)).toBe(PLAN.phase2SavingsGoal);
  });
});

describe('phase switching', () => {
  const entries = [entry('dining', 150)];
  test('same spend is under cap in phase 1 but over in phase 2', () => {
    const p1 = categoryProgress(CATEGORIES.find((x) => x.id === 'dining')!, entries, 1);
    const p2 = categoryProgress(CATEGORIES.find((x) => x.id === 'dining')!, entries, 2);
    expect(p1.status).toBe('ok'); // 150 of 200
    expect(p1.remaining).toBe(c(50));
    expect(p2.status).toBe('over'); // 150 of 100
    expect(p2.remaining).toBe(c(-50));
  });

  test('a zero-cap category (venmo phase 2) is over the moment anything is logged', () => {
    const venmo = CATEGORIES.find((x) => x.id === 'venmo')!;
    const p = categoryProgress(venmo, [entry('venmo', 10)], 2);
    expect(p.cap).toBe(0);
    expect(p.status).toBe('over');
    expect(p.fraction).toBe(1);
  });

  test('zero-cap category with no spend is not over', () => {
    const venmo = CATEGORIES.find((x) => x.id === 'venmo')!;
    const p = categoryProgress(venmo, [], 2);
    expect(p.status).toBe('ok');
    expect(p.fraction).toBe(0);
  });
});

describe('category progress thresholds', () => {
  const groceries = CATEGORIES.find((x) => x.id === 'groceries')!; // phase1 cap 975
  test('near threshold trips just above 85% of cap', () => {
    const p = categoryProgress(groceries, [entry('groceries', 830)], 1); // 830/975 = 85.1%
    expect(p.status).toBe('near');
  });
  test('below 85% is ok', () => {
    const p = categoryProgress(groceries, [entry('groceries', 800)], 1); // 82%
    expect(p.status).toBe('ok');
  });
  test('fraction clamps at 1 when over', () => {
    const p = categoryProgress(groceries, [entry('groceries', 2000)], 1);
    expect(p.fraction).toBe(1);
    expect(p.status).toBe('over');
  });
});

describe('spent aggregation', () => {
  const entries = [entry('dining', 20), entry('dining', 5), entry('gas', 40), entry('ghost', 99)];
  test('spentByCategory sums per category and ignores unknown ids', () => {
    const map = spentByCategory(entries, CATEGORIES);
    expect(map.dining).toBe(c(25));
    expect(map.gas).toBe(c(40));
    expect(map.shopping).toBe(0);
    expect((map as any).ghost).toBeUndefined();
  });
  test('totalSpent ignores unknown-category entries', () => {
    expect(totalSpent(entries, CATEGORIES)).toBe(c(65));
  });
});

describe('pace calculation', () => {
  test('on pace when spend is at or below the month-elapsed target', () => {
    // Day 12 of a 30-day month = 40% elapsed. Cap $2390 -> target $956.
    const cap = totalCap(CATEGORIES, 1);
    const pace = computePace(c(900), cap, 12 / 30);
    expect(pace.paceTarget).toBe(c(956));
    expect(pace.onPace).toBe(true);
  });
  test('ahead of pace when spending faster than the month elapses', () => {
    const cap = totalCap(CATEGORIES, 1);
    const pace = computePace(c(1500), cap, 12 / 30);
    expect(pace.onPace).toBe(false);
  });
  test('spendFraction clamps to 1 when over the total cap', () => {
    const cap = totalCap(CATEGORIES, 2);
    const pace = computePace(cap + c(500), cap, 0.5);
    expect(pace.spendFraction).toBe(1);
  });
  test('exactly on target counts as on pace (inclusive)', () => {
    const pace = computePace(c(956), c(2390), 12 / 30);
    expect(pace.onPace).toBe(true);
  });
});

describe('savings achieved', () => {
  test('phase 2, exactly at cap => full $500 saved', () => {
    const cap = totalCap(CATEGORIES, 2);
    expect(savingsAchieved(2, cap, cap)).toBe(c(500));
  });
  test('phase 2 underspend adds to the goal (500 + underspend)', () => {
    const cap = totalCap(CATEGORIES, 2);
    expect(savingsAchieved(2, cap, cap - c(120))).toBe(c(620));
  });
  test('phase 2 overage subtracts from the goal (500 - overage)', () => {
    const cap = totalCap(CATEGORIES, 2);
    expect(savingsAchieved(2, cap, cap + c(200))).toBe(c(300));
  });
  test('phase 1 targets breakeven: underspend is the saved amount', () => {
    const cap = totalCap(CATEGORIES, 1);
    expect(savingsAchieved(1, cap, cap - c(90))).toBe(c(90));
    expect(savingsAchieved(1, cap, cap)).toBe(0);
  });
});

describe('month rollover', () => {
  test('archives the month with its phase, totals and savings, then clears entries', () => {
    const entries = [entry('groceries', 800), entry('dining', 90)];
    const { record, nextEntries } = rolloverMonth('2026-07', 2, entries, CATEGORIES);
    expect(record.month).toBe('2026-07');
    expect(record.phase).toBe(2);
    expect(record.totalCap).toBe(totalCap(CATEGORIES, 2));
    expect(record.totalSpent).toBe(c(890));
    expect(record.savings).toBe(savingsAchieved(2, totalCap(CATEGORIES, 2), c(890)));
    expect(record.entries).toHaveLength(2);
    expect(nextEntries).toEqual([]);
  });
  test('snapshots the phase it ran under, not a later active phase', () => {
    const entries = [entry('shopping', 400)];
    // Ran the month in phase 1 even though user may now be on phase 2.
    const { record } = rolloverMonth('2026-06', 1, entries, CATEGORIES);
    expect(record.phase).toBe(1);
    expect(record.totalCap).toBe(totalCap(CATEGORIES, 1));
  });
});

describe('money helpers', () => {
  test('parseDollarsToCents handles plain, decimal, and $/comma input', () => {
    expect(parseDollarsToCents('12')).toBe(1200);
    expect(parseDollarsToCents('12.5')).toBe(1250);
    expect(parseDollarsToCents('$1,234.56')).toBe(123456);
  });
  test('parseDollarsToCents rejects non-positive and garbage', () => {
    expect(parseDollarsToCents('0')).toBeNull();
    expect(parseDollarsToCents('-5')).toBeNull();
    expect(parseDollarsToCents('abc')).toBeNull();
    expect(parseDollarsToCents('')).toBeNull();
  });
  test('formatters render cents as dollars', () => {
    expect(fmtWhole(123456)).toBe('$1,235');
    expect(fmtCents(123456)).toBe('$1,234.56');
    expect(fmtCents(500)).toBe('$5.00');
  });
});

describe('date helpers', () => {
  test('monthKey and isoDate use local calendar fields', () => {
    const d = new Date(2026, 6, 5, 23, 30); // July 5 2026, 11:30pm local
    expect(monthKey(d)).toBe('2026-07');
    expect(isoDate(d)).toBe('2026-07-05');
  });
  test('monthPosition reflects day within month', () => {
    const pos = monthPosition(new Date(2026, 6, 10)); // July 10, 31-day month
    expect(pos.day).toBe(10);
    expect(pos.total).toBe(31);
    expect(pos.pct).toBeCloseTo(10 / 31);
    expect(pos.key).toBe('2026-07');
  });
  test('monthLabel renders a friendly month/year', () => {
    expect(monthLabel('2026-07')).toBe('July 2026');
  });
});
