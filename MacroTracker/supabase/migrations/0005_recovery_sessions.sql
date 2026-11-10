-- Recovery sessions: sauna and cold plunge.
--
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New
-- query). Idempotent and additive, like 0001–0004 — safe to re-run.
--
-- IMPORTANT: run this BEFORE shipping the build that writes these columns.
-- PostgREST rejects an upsert naming a column that doesn't exist, and both
-- writers send a whole row at once — so an un-migrated table means no
-- finished workout syncs at all (activity_type), and no setting syncs at all
-- (recovery_presets), not merely the new fields.
--
--   workouts.activity_type       — HKWorkoutActivityType raw value. 50 is
--                                  strength; 3000 ("other") marks a recovery
--                                  session, sauna or cold plunge, which the
--                                  app tells apart by name.
--
--   user_settings.recovery_presets — the timer's last target and direction
--                                  per recovery kind, e.g.
--                                  {"sauna":{"targetSeconds":900,"mode":"down"}}
--
-- activity_type is nullable with no default. Null means "saved before this
-- column existed", which the app already reads as strength — the same rule
-- WorkoutTemplate.activityType has always used. A default of 50 would have
-- claimed those rows were explicitly typed when nothing typed them.
--
-- recovery_presets defaults to an empty object rather than null so hydrate
-- reads it the way it reads the other object-valued settings.

alter table public.workouts
  add column if not exists activity_type smallint;

alter table public.user_settings
  add column if not exists recovery_presets jsonb not null default '{}'::jsonb;
