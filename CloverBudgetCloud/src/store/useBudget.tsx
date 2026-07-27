// Cloud-synced app state. Same shape/hook name as the offline CloverBudget
// app's store, but backed by Supabase (Postgres + Realtime) instead of
// AsyncStorage, so every signed-in device sees the same live budget. This is
// a prototype: only the current month's entries + active phase sync. History,
// editable plan lists, and AI statement import are intentionally out of scope
// — see CLAUDE.md.

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Entry, Phase } from '../types';
import { supabase } from '../lib/supabase';
import { isSupabaseConfigured } from '../config';
import { isoDate, monthKey } from '../lib/dates';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface Row {
  id: string;
  user_id: string;
  category_id: string;
  amount: number;
  note: string | null;
  date: string;
}

function rowToEntry(r: Row): Entry {
  return { id: r.id, categoryId: r.category_id, amount: r.amount, note: r.note ?? '', date: r.date };
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

interface BudgetContextValue {
  configured: boolean;
  session: Session | null;
  authLoading: boolean;
  authError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;

  loaded: boolean;
  saveState: SaveState;
  activePhase: Phase;
  entries: Entry[];
  addEntry: (input: { categoryId: string; amount: number; note: string; date?: string }) => void;
  updateEntry: (id: string, patch: Partial<{ categoryId: string; amount: number; note: string }>) => void;
  removeEntry: (id: string) => void;
  setPhase: (phase: Phase) => void;
}

const BudgetContext = createContext<BudgetContextValue | null>(null);

export function BudgetProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const [entries, setEntries] = useState<Entry[]>([]);
  const [activePhase, setActivePhase] = useState<Phase>(1);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashSaved = () => {
    setSaveState('saved');
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaveState('idle'), 1500);
  };

  // Track auth session.
  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Load current month's entries + settings, then subscribe to realtime
  // changes, whenever we have a signed-in session.
  useEffect(() => {
    if (!supabase || !session) {
      setEntries([]);
      setActivePhase(1);
      setLoaded(false);
      return;
    }
    const client = supabase;
    const userId = session.user.id;
    let cancelled = false;

    (async () => {
      const month = monthKey(new Date());
      const [{ data: entryRows }, { data: settingsRow }] = await Promise.all([
        client
          .from('budget_entries')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: false }),
        client.from('budget_settings').select('*').eq('user_id', userId).maybeSingle(),
      ]);
      if (cancelled) return;
      const rows = ((entryRows ?? []) as Row[]).filter((r) => r.date.startsWith(month));
      setEntries(rows.map(rowToEntry));
      setActivePhase(settingsRow?.active_phase === 2 ? 2 : 1);
      setLoaded(true);
    })();

    const channel = client
      .channel(`budget-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'budget_entries', filter: `user_id=eq.${userId}` },
        (payload) => {
          const month = monthKey(new Date());
          if (payload.eventType === 'DELETE') {
            const old = payload.old as { id: string };
            setEntries((cur) => cur.filter((e) => e.id !== old.id));
          } else {
            const row = payload.new as Row;
            if (!row.date.startsWith(month)) return;
            const entry = rowToEntry(row);
            setEntries((cur) => {
              const withoutDup = cur.filter((e) => e.id !== entry.id);
              return [entry, ...withoutDup].sort((a, b) => (a.date < b.date ? 1 : -1));
            });
          }
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'budget_settings', filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as { active_phase: number } | undefined;
          if (row) setActivePhase(row.active_phase === 2 ? 2 : 1);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      client.removeChannel(channel);
    };
  }, [session]);

  const value = useMemo<BudgetContextValue>(() => {
    const signIn: BudgetContextValue['signIn'] = async (email, password) => {
      if (!supabase) return;
      setAuthError(null);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setAuthError(error.message);
    };

    const signUp: BudgetContextValue['signUp'] = async (email, password) => {
      if (!supabase) return;
      setAuthError(null);
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setAuthError(error.message);
    };

    const signOut: BudgetContextValue['signOut'] = async () => {
      if (!supabase) return;
      await supabase.auth.signOut();
    };

    const addEntry: BudgetContextValue['addEntry'] = ({ categoryId, amount, note, date }) => {
      if (!supabase || !session || !Number.isFinite(amount) || amount <= 0) return;
      const entry: Entry = {
        id: makeId(),
        categoryId,
        amount: Math.round(amount),
        note: note.trim(),
        date: date ?? isoDate(new Date()),
      };
      // Optimistic local update; realtime echo dedupes by id.
      setEntries((cur) => [entry, ...cur]);
      setSaveState('saving');
      supabase
        .from('budget_entries')
        .insert({
          id: entry.id,
          user_id: session.user.id,
          category_id: entry.categoryId,
          amount: entry.amount,
          note: entry.note,
          date: entry.date,
        })
        .then(({ error }) => {
          if (error) setSaveState('error');
          else flashSaved();
        });
    };

    const updateEntry: BudgetContextValue['updateEntry'] = (id, patch) => {
      if (!supabase || !session) return;
      if (patch.amount !== undefined && (!Number.isFinite(patch.amount) || patch.amount <= 0)) return;
      setEntries((cur) => cur.map((e) => (e.id === id ? { ...e, ...patch } : e)));
      const row: Record<string, unknown> = {};
      if (patch.categoryId !== undefined) row.category_id = patch.categoryId;
      if (patch.amount !== undefined) row.amount = Math.round(patch.amount);
      if (patch.note !== undefined) row.note = patch.note.trim();
      setSaveState('saving');
      supabase
        .from('budget_entries')
        .update(row)
        .eq('id', id)
        .eq('user_id', session.user.id)
        .then(({ error }) => {
          if (error) setSaveState('error');
          else flashSaved();
        });
    };

    const removeEntry: BudgetContextValue['removeEntry'] = (id) => {
      if (!supabase || !session) return;
      setEntries((cur) => cur.filter((e) => e.id !== id));
      supabase
        .from('budget_entries')
        .delete()
        .eq('id', id)
        .eq('user_id', session.user.id)
        .then(({ error }) => {
          if (error) setSaveState('error');
          else flashSaved();
        });
    };

    const setPhase: BudgetContextValue['setPhase'] = (phase) => {
      if (!supabase || !session) return;
      setActivePhase(phase);
      supabase
        .from('budget_settings')
        .upsert({ user_id: session.user.id, active_phase: phase, updated_at: new Date().toISOString() })
        .then(({ error }) => {
          if (error) setSaveState('error');
          else flashSaved();
        });
    };

    return {
      configured: isSupabaseConfigured,
      session,
      authLoading,
      authError,
      signIn,
      signUp,
      signOut,
      loaded,
      saveState,
      activePhase,
      entries,
      addEntry,
      updateEntry,
      removeEntry,
      setPhase,
    };
  }, [session, authLoading, authError, loaded, saveState, activePhase, entries]);

  return <BudgetContext.Provider value={value}>{children}</BudgetContext.Provider>;
}

export function useBudget(): BudgetContextValue {
  const ctx = useContext(BudgetContext);
  if (!ctx) throw new Error('useBudget must be used within BudgetProvider');
  return ctx;
}
