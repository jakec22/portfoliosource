-- Clover Budget Cloud schema: current-month entries + phase setting, synced
-- live across every signed-in device via Supabase Realtime.
--
-- Run this once in the Supabase SQL editor (Dashboard -> SQL Editor -> New
-- query). It is idempotent and additive — safe to (re)run at any time.

-- ── budget_entries ───────────────────────────────────────────────────────────
-- One row per logged purchase.
create table if not exists public.budget_entries (
  id          text primary key,
  user_id     uuid not null references auth.users on delete cascade,
  category_id text not null,
  amount      integer not null,  -- cents
  note        text,
  date        text not null,     -- "YYYY-MM-DD"
  created_at  timestamptz not null default now()
);

create index if not exists budget_entries_user_id_idx on public.budget_entries (user_id);

-- ── budget_settings ──────────────────────────────────────────────────────────
-- One row per user holding the active phase (1 = breakeven, 2 = +$500 saved).
create table if not exists public.budget_settings (
  user_id      uuid primary key references auth.users on delete cascade,
  active_phase integer not null default 1,
  updated_at   timestamptz not null default now()
);

-- ── Row-level security ───────────────────────────────────────────────────────
-- Each signed-in user can only see/modify their own rows. This prototype uses
-- one shared login for the whole family, so in practice every row belongs to
-- that single auth.uid() — but the policy is still per-user, not "open".
alter table public.budget_entries  enable row level security;
alter table public.budget_settings enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['budget_entries', 'budget_settings']
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = t
        and policyname = 'Users manage own rows'
    ) then
      execute format(
        'create policy "Users manage own rows" on public.%I
           for all using (auth.uid() = user_id) with check (auth.uid() = user_id)',
        t
      );
    end if;
  end loop;
end $$;

-- ── Realtime ─────────────────────────────────────────────────────────────────
-- Add both tables to the realtime publication so INSERT/UPDATE/DELETE stream
-- to every subscribed client. No-ops (with a notice) if already added.
do $$
begin
  execute 'alter publication supabase_realtime add table public.budget_entries';
exception when duplicate_object then null;
end $$;

do $$
begin
  execute 'alter publication supabase_realtime add table public.budget_settings';
exception when duplicate_object then null;
end $$;
