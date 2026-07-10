# CLAUDE.md — Clover Budget Cloud

A **prototype**, sibling to the offline `CloverBudget` app in this repo. Same
Expo/React Native/TypeScript codebase and design system, but the store is
backed by Supabase (Postgres + Realtime + Auth) instead of AsyncStorage, to
answer one question: can this budget app sync live between a phone and a
browser? See `README.md` for the one-time Supabase setup and what is/isn't
proven by this prototype.

**Do not merge changes here into `CloverBudget/` or vice versa** — they are
intentionally separate apps. `CloverBudget/` is the real, shipping, offline
app; this folder is a side experiment.

## Scope (deliberately trimmed)

Only the core dashboard loop is synced: log a purchase, switch phase, see
caps/runway/category bars update live across devices. Explicitly **out of
scope** for this prototype:
- History / month rollover
- The editable Plan screen (fixed costs / recurring income / subscriptions)
- AI bank-statement import

If any of these get pulled in later, mirror the equivalent screen from
`CloverBudget/` and add the backing Supabase table(s) + RLS policy the same
way `budget_entries` / `budget_settings` are done in `supabase/schema.sql`.

## Stack differences from `CloverBudget/`

- Auth + data: `@supabase/supabase-js`, `react-native-url-polyfill`. Session
  persisted via AsyncStorage per Supabase's documented RN pattern (see
  `src/lib/supabase.ts`, mirrors `MacroTracker/src/services/supabase.ts`).
- One shared login for the whole family (one email/password), not a
  multi-user household model — a deliberate prototype simplification, not a
  final product decision.
- `src/store/useBudget.tsx` keeps the same hook name/shape (`useBudget()`,
  `SaveState`) as the offline app so the copied UI components (`LogPurchase`,
  `DashboardScreen`, etc.) work with minimal changes, but every read/write
  goes through Supabase + a realtime `postgres_changes` subscription instead
  of `AsyncStorage.getItem`/`setItem`.
- No local fallback: if `EXPO_PUBLIC_SUPABASE_URL`/`_ANON_KEY` aren't set,
  `src/lib/supabase.ts` exports `supabase: null` and `App.tsx` shows
  `NotConfiguredScreen` instead of crashing.

## Conventions (unchanged from `CloverBudget/`)

- Money is integer cents everywhere; only `src/lib/money.ts` converts to
  dollars for display.
- Colors/type live in `src/theme/theme.ts` only.
- Cap/pace math is pure, lives in `src/lib/budget.ts`, unit-tested in
  `src/__tests__/budget.test.ts`.

## Commands

- Install: `npm install`
- Test (pure logic): `npm test`
- Typecheck: `npx tsc --noEmit`
- Run in browser: `npm run web`
- Run on a phone: `npx expo start` and scan the QR code with Expo Go
