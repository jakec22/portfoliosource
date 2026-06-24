-- Cloud sync for workouts + the remaining preferences/templates.
--
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- It is additive and idempotent: existing data in `user_settings` and
-- `food_entries` is untouched, and re-running it is safe.

-- ── 1. New preference + template columns on user_settings ────────────────────
-- These previously lived only in the device's local store and were lost on
-- reinstall. They now round-trip through the cloud like the other settings.
alter table public.user_settings
  add column if not exists show_water_tracker  boolean,
  add column if not exists auto_rest_timer      boolean,
  add column if not exists default_rest_seconds integer,
  add column if not exists workout_templates    jsonb;

-- ── 2. Workout history table ─────────────────────────────────────────────────
-- One row per completed session, mirroring how food_entries stores logs so a
-- session can be upserted or deleted individually.
create table if not exists public.workouts (
  id                 text primary key,
  user_id            uuid not null references auth.users on delete cascade,
  name               text,
  template_id        text,
  date               text,
  started_at         bigint,
  completed_at       bigint,
  exercises          jsonb not null default '[]'::jsonb,
  heart_rate_samples jsonb,
  updated_at         timestamptz not null default now()
);

create index if not exists workouts_user_id_idx on public.workouts (user_id);

-- ── 3. Row-level security: a user can only see/modify their own workouts ──────
alter table public.workouts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'workouts'
      and policyname = 'Users manage own workouts'
  ) then
    create policy "Users manage own workouts"
      on public.workouts
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;
