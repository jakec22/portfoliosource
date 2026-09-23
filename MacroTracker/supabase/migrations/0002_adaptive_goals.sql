-- Adaptive goals: let targets follow body weight.
--
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New
-- query). Idempotent and additive, like 0001 — safe to re-run.
--
-- IMPORTANT: run this BEFORE shipping the build that writes these columns.
-- PostgREST rejects an insert naming a column that doesn't exist, so the app
-- would fail every settings sync until the table catches up.
--
--   goals_auto_update      — whether goals track body weight. False once the
--                            user types targets in by hand, or switches it off
--                            from the "Goals updated" card on Home.
--   goals_basis_weight_lbs — the body weight the current goals were computed
--                            from. NULL means hand-set goals, which is what
--                            marks them as not wizard-managed; the app only
--                            rebuilds targets when this is present.

alter table public.user_settings
  add column if not exists goals_auto_update      boolean,
  add column if not exists goals_basis_weight_lbs numeric;

-- Existing rows predate the feature. Default them to tracking enabled, and
-- seed the basis weight from the profile the Goal Wizard saved, so the first
-- weigh-in after updating doesn't read as an unbounded drift and immediately
-- rewrite everyone's targets.
update public.user_settings
   set goals_auto_update = coalesce(goals_auto_update, true),
       goals_basis_weight_lbs = coalesce(
         goals_basis_weight_lbs,
         nullif(profile ->> 'weightLbs', '')::numeric
       )
 where goals_auto_update is null
    or goals_basis_weight_lbs is null;
