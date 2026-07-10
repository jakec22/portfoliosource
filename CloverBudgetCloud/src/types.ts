// Shared domain types for Clover Budget.
//
// Money is stored and computed in integer **cents** everywhere to avoid the
// float-rounding bugs the JSX reference is prone to. Only the display layer
// converts to dollars, via lib/money.ts.

export type Phase = 1 | 2;

export interface Category {
  id: string;
  name: string;
  hint: string;
  /** Reference-only actual spend from the baseline month, in cents. */
  baselineActual: number;
  /** Flexible cap for Phase 1 (breakeven), in cents. */
  phase1Cap: number;
  /** Flexible cap for Phase 2 (breakeven + savings), in cents. */
  phase2Cap: number;
}

export interface Entry {
  id: string;
  categoryId: string;
  /** Amount in cents. Always a positive integer. */
  amount: number;
  note: string;
  /** ISO date, "YYYY-MM-DD". */
  date: string;
}

/** A finished month kept as history after a rollover. */
export interface MonthRecord {
  /** Month key, "YYYY-MM". */
  month: string;
  phase: Phase;
  totalCap: number; // cents
  totalSpent: number; // cents
  /** Savings achieved for the month, in cents (see lib/budget.ts). */
  savings: number;
  entries: Entry[];
}

/** A user-editable reference line on the "About the plan" screen —
 * a fixed cost, a recurring income source, or a subscription. */
export interface PlanItem {
  id: string;
  name: string;
  /** Amount in cents. */
  amount: number;
}

export type PlanList = 'fixedCosts' | 'recurringIncome' | 'subscriptions';

/** The whole persisted app state. */
export interface BudgetState {
  activePhase: Phase;
  /** Month key the live entries belong to, "YYYY-MM". */
  currentMonth: string;
  entries: Entry[];
  history: MonthRecord[];
  fixedCosts: PlanItem[];
  recurringIncome: PlanItem[];
  subscriptions: PlanItem[];
}
