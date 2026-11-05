-- Custom exercises: sync the names typed at the rack.
--
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New
-- query). Idempotent and additive, like 0001 and 0002 — safe to re-run.
--
-- IMPORTANT: run this BEFORE shipping the build that writes the column.
-- PostgREST rejects an upsert naming a column that doesn't exist, and
-- pushSettings sends the whole settings row at once — so a push carrying
-- custom_exercises against an un-migrated table fails the entire upsert,
-- taking goals, templates, saved meals and water with it.
--
--   custom_exercises — exercise names the user typed into the picker rather
--                      than choosing from EXERCISE_CATALOG. A JSON array of
--                      strings, sorted, compared case-insensitively by the
--                      app so "hack squat" and "Hack Squat" stay one entry.
--
-- Defaults to an empty array rather than null so hydrate's "only take the
-- cloud copy when it has items" rule reads it the same way as the other
-- list-valued settings.

alter table public.user_settings
  add column if not exists custom_exercises jsonb not null default '[]'::jsonb;
