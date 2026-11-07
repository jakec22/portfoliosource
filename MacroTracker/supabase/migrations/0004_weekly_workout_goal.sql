-- Weekly workout goal: the number the consistency ring fills toward.
--
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New
-- query). Idempotent and additive, like 0001–0003 — safe to re-run.
--
-- IMPORTANT: run this BEFORE shipping the build that writes the column.
-- PostgREST rejects an upsert naming a column that doesn't exist, and
-- pushSettings sends the whole settings row at once — so a push carrying
-- weekly_workout_goal against an un-migrated table fails the entire upsert,
-- taking goals, templates, saved meals and water with it. Same hazard as
-- 0003; the comment is repeated rather than referenced because the person
-- running this is looking at this file.
--
--   weekly_workout_goal — sessions per week the Home and Exercise consistency
--                         rings measure against. Collected by the goal wizard
--                         alongside calories and macros.
--
-- Defaults to 4, which is the constant both rings were hardcoded to before
-- this column existed. An existing row therefore keeps behaving exactly as it
-- did, and nobody's ring moves because they synced.
--
-- smallint, not jsonb: it is one small number, and the app clamps it to 1–14
-- before writing. The check constraint is the same bound, so a bad client can
-- not park a zero here and make the ring divide by it.

alter table public.user_settings
  add column if not exists weekly_workout_goal smallint not null default 4;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_settings_weekly_workout_goal_range'
  ) then
    alter table public.user_settings
      add constraint user_settings_weekly_workout_goal_range
      check (weekly_workout_goal between 1 and 14);
  end if;
end $$;
