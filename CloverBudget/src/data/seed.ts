// Seed data ported from budget_data.json (the real family plan).
// Every dollar figure is converted to integer cents at load via `c()`.
// Caps and category names come from a real financial plan — do not "fix" them.

import type { Category, PlanItem } from '../types';

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

// Reference data for the "About the plan" screen. Seeded on first launch,
// then fully user-editable (add/delete) — see store/useBudget.tsx.
export const FIXED_COSTS: PlanItem[] = [
  { id: 'rent',      name: 'Rent / Mortgage (Draft)',        amount: c(2700.00) },
  { id: 'insurance', name: 'Insurance (USAA auto + life)',   amount: c(207.78) },
  { id: 'internet',  name: 'Internet (Cox)',                 amount: c(124.00) },
  { id: 'investing', name: 'Investing (Vanguard auto-buys)', amount: c(200.00) },
];

export const RECURRING_INCOME: PlanItem[] = [
  { id: 'payroll',   name: 'Payroll (2x monthly)', amount: c(5172.60) },
  { id: 'edeposits', name: 'eDeposits (avg.)',     amount: c(450.00) },
];

export const SUBSCRIPTIONS: PlanItem[] = [
  { id: 'spotify',    name: 'Spotify',            amount: c(21.99) },
  { id: 'apple1',     name: 'Apple.com/bill #1',  amount: c(26.97) },
  { id: 'apple2',     name: 'Apple.com/bill #2',  amount: c(12.99) },
  { id: 'apple3',     name: 'Apple.com/bill #3',  amount: c(71.99) },
  { id: 'amazon',     name: 'Amazon Prime',       amount: c(16.15) },
  { id: 'oura',       name: 'Oura Ring',          amount: c(5.99) },
  { id: 'youtube',    name: 'YouTube Premium',    amount: c(26.99) },
  { id: 'googleone',  name: 'Google One',         amount: c(1.99) },
  { id: 'netflix',    name: 'Netflix',            amount: c(26.99) },
  { id: 'talkspace',  name: 'Talkspace',          amount: c(25.00) },
  { id: 'spdermave',  name: 'Sp Dermave',         amount: c(21.44) },
  { id: 'ctlp',       name: 'Ctlp Entertainment', amount: c(8.00) },
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
