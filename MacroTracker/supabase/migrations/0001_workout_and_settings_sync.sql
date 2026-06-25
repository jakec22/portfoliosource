-- Full cloud-sync schema: user settings, food entries, and workout history.
--
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- It is idempotent and additive: it creates any missing tables/columns/policies
-- and leaves existing data untouched, so it's safe to (re)run at any time.
--
-- NOTE: an earlier version of this file assumed `user_settings` already existed
-- and only ALTERed it. If you hit "relation public.user_settings does not exist",
-- this version is the fix — it creates every table from scratch.

-- ── user_settings ────────────────────────────────────────────────────────────
-- One row per user holding all the singleton "settings" state: goals, water
-- config + intake, body weight, recent foods, preferences, and workout
-- templates. Pushed as a whole-row upsert whenever any of these change.
create table if not exists public.user_settings (
  user_id              uuid primary key references auth.users on delete cascade,
  goals                jsonb,
  water_goal           numeric,
  water_increment      numeric,
  show_water_tracker   boolean,
  theme_mode           text,
  auto_rest_timer      boolean,
  default_rest_seconds integer,
  body_weight_lbs      numeric,
  body_weight_log      jsonb,
  profile              jsonb,
  recent_foods         jsonb,
  favorite_foods       jsonb,
  custom_foods         jsonb,
  saved_meals          jsonb,
  water_intake         jsonb,
  workout_templates    jsonb,
  updated_at           timestamptz not null default now()
);

-- Backfill every column onto a user_settings table that predates this schema.
-- `create table if not exists` above is a no-op when the table already exists,
-- so if an older/partial user_settings was created previously (e.g. with only
-- the water columns), these ensure the rest of the columns are present too.
alter table public.user_settings
  add column if not exists goals                jsonb,
  add column if not exists water_goal           numeric,
  add column if not exists water_increment      numeric,
  add column if not exists show_water_tracker   boolean,
  add column if not exists theme_mode           text,
  add column if not exists auto_rest_timer      boolean,
  add column if not exists default_rest_seconds integer,
  add column if not exists body_weight_lbs      numeric,
  add column if not exists body_weight_log      jsonb,
  add column if not exists profile              jsonb,
  add column if not exists recent_foods         jsonb,
  add column if not exists favorite_foods       jsonb,
  add column if not exists custom_foods         jsonb,
  add column if not exists saved_meals          jsonb,
  add column if not exists water_intake         jsonb,
  add column if not exists workout_templates    jsonb;

-- ── food_entries ─────────────────────────────────────────────────────────────
-- One row per logged food item, upserted/deleted individually.
create table if not exists public.food_entries (
  id           text primary key,
  user_id      uuid not null references auth.users on delete cascade,
  date         text,
  meal         text,
  food         jsonb,
  servings     numeric,
  amount       numeric,
  unit         text,
  timestamp_ms bigint,
  updated_at   timestamptz not null default now()
);

create index if not exists food_entries_user_id_idx on public.food_entries (user_id);

-- ── workouts ─────────────────────────────────────────────────────────────────
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

-- ── Row-level security ───────────────────────────────────────────────────────
-- Each user can only see/modify rows tied to their own auth.uid().
alter table public.user_settings enable row level security;
alter table public.food_entries  enable row level security;
alter table public.workouts      enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['user_settings', 'food_entries', 'workouts']
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
