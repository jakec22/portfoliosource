-- Body weight moves out of user_settings into its own table.
--
-- RUN THIS BEFORE SHIPPING THE BUILD THAT CARRIES IT.
--
-- Until now every weigh-in lived inside the single `body_weight_log` jsonb
-- column on user_settings, which meant the whole history was re-uploaded
-- whenever anything in settings changed — a water-goal tweak sent years of
-- weigh-ins with it. It also only ever grew.
--
-- One row per weigh-in instead, keyed on the millisecond it was logged, so a
-- single entry can be added or removed on its own. This mirrors how food
-- entries and workouts already sync.
--
-- The old column is deliberately left in place and still read once by the app
-- (see hydrate.ts), so a device that has not upgraded keeps working and the
-- first upgraded launch copies the history across. Drop it in a later
-- migration once every client is past this build.

create table if not exists public.body_weight (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  logged_at  bigint      not null, -- ms epoch; unique per user
  date       text        not null, -- YYYY-MM-DD, the day it counts for
  lbs        real        not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, logged_at)
);

create index if not exists body_weight_user_id_idx on public.body_weight (user_id);

alter table public.body_weight enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'body_weight'
      and policyname = 'Users manage own rows'
  ) then
    create policy "Users manage own rows" on public.body_weight
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;
