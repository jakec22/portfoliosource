// App state + persistence. Kept deliberately small: a Context holding the
// BudgetState, with AsyncStorage as the offline store (the RN equivalent of
// the spec's SwiftData — no accounts, no network). All money math is delegated
// to lib/budget.ts; this file only owns state transitions and I/O.

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BudgetState, Entry, MonthRecord, Phase, PlanItem, PlanList } from '../types';
import { PLAN, FIXED_COSTS, RECURRING_INCOME, SUBSCRIPTIONS } from '../data/seed';
import { CATEGORIES } from '../data/seed';
import { rolloverMonth } from '../lib/budget';
import { isoDate, monthKey } from '../lib/dates';

const STORAGE_KEY = 'clover-budget/state/v1';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function freshState(now: Date): BudgetState {
  return {
    activePhase: PLAN.activePhaseDefault,
    currentMonth: monthKey(now),
    entries: [],
    history: [],
    fixedCosts: FIXED_COSTS,
    recurringIncome: RECURRING_INCOME,
    subscriptions: SUBSCRIPTIONS,
  };
}

interface BudgetContextValue {
  state: BudgetState;
  loaded: boolean;
  saveState: SaveState;
  addEntry: (input: { categoryId: string; amount: number; note: string; date?: string }) => void;
  updateEntry: (id: string, patch: Partial<Omit<Entry, 'id'>>) => void;
  removeEntry: (id: string) => void;
  setPhase: (phase: Phase) => void;
  startNewMonth: () => void;
  addPlanItem: (list: PlanList, input: { name: string; amount: number }) => void;
  removePlanItem: (list: PlanList, id: string) => void;
}

const BudgetContext = createContext<BudgetContextValue | null>(null);

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function BudgetProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<BudgetState>(() => freshState(new Date()));
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load once on mount.
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as BudgetState;
          setState(normalize(parsed));
        }
      } catch {
        // Corrupt/missing data — fall back to a fresh month.
      }
      setLoaded(true);
    })();
  }, []);

  // Persist whenever state changes (after the initial load).
  useEffect(() => {
    if (!loaded) return;
    setSaveState('saving');
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      .then(() => {
        setSaveState('saved');
        if (savedTimer.current) clearTimeout(savedTimer.current);
        savedTimer.current = setTimeout(() => setSaveState('idle'), 1500);
      })
      .catch(() => setSaveState('error'));
  }, [state, loaded]);

  const value = useMemo<BudgetContextValue>(() => {
    const addEntry: BudgetContextValue['addEntry'] = ({ categoryId, amount, note, date }) => {
      if (!Number.isFinite(amount) || amount <= 0) return;
      const entry: Entry = {
        id: makeId(),
        categoryId,
        amount: Math.round(amount),
        note: note.trim(),
        date: date ?? isoDate(new Date()),
      };
      setState((s) => ({ ...s, entries: [entry, ...s.entries] }));
    };

    const updateEntry: BudgetContextValue['updateEntry'] = (id, patch) => {
      setState((s) => ({
        ...s,
        entries: s.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      }));
    };

    const removeEntry: BudgetContextValue['removeEntry'] = (id) => {
      setState((s) => ({ ...s, entries: s.entries.filter((e) => e.id !== id) }));
    };

    const setPhase: BudgetContextValue['setPhase'] = (phase) => {
      setState((s) => ({ ...s, activePhase: phase }));
    };

    const startNewMonth: BudgetContextValue['startNewMonth'] = () => {
      setState((s) => {
        const { record, nextEntries } = rolloverMonth(
          s.currentMonth,
          s.activePhase,
          s.entries,
          CATEGORIES,
        );
        const history: MonthRecord[] = [record, ...s.history];
        return {
          ...s,
          currentMonth: monthKey(new Date()),
          entries: nextEntries,
          history,
        };
      });
    };

    const addPlanItem: BudgetContextValue['addPlanItem'] = (list, { name, amount }) => {
      const trimmed = name.trim();
      if (!trimmed || !Number.isFinite(amount) || amount <= 0) return;
      const item: PlanItem = { id: makeId(), name: trimmed, amount: Math.round(amount) };
      setState((s) => ({ ...s, [list]: [...s[list], item] }));
    };

    const removePlanItem: BudgetContextValue['removePlanItem'] = (list, id) => {
      setState((s) => ({ ...s, [list]: s[list].filter((item) => item.id !== id) }));
    };

    return {
      state,
      loaded,
      saveState,
      addEntry,
      updateEntry,
      removeEntry,
      setPhase,
      startNewMonth,
      addPlanItem,
      removePlanItem,
    };
  }, [state, loaded, saveState]);

  return <BudgetContext.Provider value={value}>{children}</BudgetContext.Provider>;
}

/** Guard against older/partial persisted shapes. */
function normalize(s: Partial<BudgetState>): BudgetState {
  const base = freshState(new Date());
  return {
    activePhase: s.activePhase === 2 ? 2 : 1,
    currentMonth: s.currentMonth ?? base.currentMonth,
    entries: Array.isArray(s.entries) ? s.entries : [],
    history: Array.isArray(s.history) ? s.history : [],
    // Installs saved before plan items were editable won't have these arrays —
    // fall back to the seed defaults so upgrading doesn't blank the Plan screen.
    fixedCosts: Array.isArray(s.fixedCosts) ? s.fixedCosts : base.fixedCosts,
    recurringIncome: Array.isArray(s.recurringIncome) ? s.recurringIncome : base.recurringIncome,
    subscriptions: Array.isArray(s.subscriptions) ? s.subscriptions : base.subscriptions,
  };
}

export function useBudget(): BudgetContextValue {
  const ctx = useContext(BudgetContext);
  if (!ctx) throw new Error('useBudget must be used within BudgetProvider');
  return ctx;
}
