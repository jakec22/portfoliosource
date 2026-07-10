// Seed data ported from budget_data.json (the real family plan).
// Every dollar figure is converted to integer cents at load via `c()`.
// Caps and category names come from a real financial plan — do not "fix" them.

import type { Category, NamedAmount, Subscription } from '../types';

/** Dollars -> integer cents, safe against float drift. */
const c = (dollars: number): number => Math.round(dollars * 100);

export const PLAN = {
  name: 'Clover Family Budget',
  baselineMonth: '2026-06', // June — shown as reference "baseline actual"
  baselineLabel: 'June',
  activePhaseDefault: 1 as const,
  phase2SavingsGoal: c(500),
} as const;

export const CATEGORIES: Category[] = [
  { id: 'shopping',      name: 'Shopping',        hint: 'Amazon, Target, Old Navy, Hobby Lobby', baselineActual: c(1355.50), phase1Cap: c(450), phase2Cap: c(300) },
  { id: 'dining',        name: 'Dining & Coffee', hint: 'Kona Loa, In-N-Out, Dutch Bros',        baselineActual: c(655.07),  phase1Cap: c(200), phase2Cap: c(100) },
  { id: 'groceries',     name: 'Groceries',       hint: "Costco, Ralphs, Walmart, Trader Joe's", baselineActual: c(1328.90), phase1Cap: c(975), phase2Cap: c(875) },
  { id: 'subscriptions', name: 'Subscriptions',   hint: 'Spotify, Apple, Netflix, YouTube',      baselineActual: c(266.49),  phase1Cap: c(120), phase2Cap: c(90) },
  { id: 'venmo',         name: 'Venmo / P2P',     hint: 'Transfers to friends & family',         baselineActual: c(330.00),  phase1Cap: c(50),  phase2Cap: c(0) },
  { id: 'gas',           name: 'Gas',             hint: 'Shell, Circle K',                       baselineActual: c(182.16),  phase1Cap: c(185), phase2Cap: c(185) },
  { id: 'utilities',     name: 'Utilities',       hint: 'Edison, SoCalGas, SMWD',                baselineActual: c(268.81),  phase1Cap: c(270), phase2Cap: c(270) },
  { id: 'misc',          name: 'Misc / Other',    hint: 'Car wash, pets, mail, everything else', baselineActual: c(233.46),  phase1Cap: c(140), phase2Cap: c(70) },
];

// Reference data for the "About the plan" screen — not tracked or editable.
export const FIXED_COSTS: NamedAmount[] = [
  { name: 'Rent / Mortgage (Draft)',        amount: c(2700.00) },
  { name: 'Insurance (USAA auto + life)',   amount: c(207.78) },
  { name: 'Internet (Cox)',                 amount: c(124.00) },
  { name: 'Investing (Vanguard auto-buys)', amount: c(200.00) },
];

export const RECURRING_INCOME: NamedAmount[] = [
  { name: 'Payroll (2x monthly)', amount: c(5172.60) },
  { name: 'eDeposits (avg.)',     amount: c(450.00) },
];

export const SUBSCRIPTIONS: Subscription[] = [
  { name: 'Spotify',            monthlyCost: c(21.99) },
  { name: 'Apple.com/bill #1',  monthlyCost: c(26.97) },
  { name: 'Apple.com/bill #2',  monthlyCost: c(12.99) },
  { name: 'Apple.com/bill #3',  monthlyCost: c(71.99) },
  { name: 'Amazon Prime',       monthlyCost: c(16.15) },
  { name: 'Oura Ring',          monthlyCost: c(5.99) },
  { name: 'YouTube Premium',    monthlyCost: c(26.99) },
  { name: 'Google One',         monthlyCost: c(1.99) },
  { name: 'Netflix',            monthlyCost: c(26.99) },
  { name: 'Talkspace',          monthlyCost: c(25.00) },
  { name: 'Sp Dermave',         monthlyCost: c(21.44) },
  { name: 'Ctlp Entertainment', monthlyCost: c(8.00) },
];

export const EXCLUDED_FROM_PLAN: string[] = [
  'Credit card payments (covered by separate income source)',
  'Tolls (eliminated)',
  'DMV fees (one-time)',
  'Columbia $1,500 deposit (one-time)',
  'Refunds / credit vouchers (not recurring)',
];

export const PHASE_RULE =
  'Move to Phase 2 after 1-2 consecutive months holding Phase 1 caps.';
