# Clover Budget Cloud (prototype)

A feasibility prototype answering: *can the family budget sync live between a
phone and a browser?* Same Expo codebase as the offline **CloverBudget** app,
same design system, but the store is backed by **Supabase** (Postgres +
Realtime + Auth) instead of on-device AsyncStorage — so a purchase logged on
one device shows up instantly everywhere else, phone or desktop.

This is deliberately trimmed down from the full app. It only proves out
live sync for the core loop:

- Sign in with one shared family login (email + password)
- Log a purchase, switch phase, see caps/runway/category bars update
- The same data, live, on every signed-in device (phone via Expo Go, desktop
  via a browser)

**Not included** (out of scope for this prototype — see `CLAUDE.md`):
History / month rollover, the editable Plan screen (fixed costs / income /
subscriptions), and AI bank-statement import.

## One-time setup (you'll need to do this yourself)

I don't have a Supabase account to create a project on your behalf, and I
can't verify live sync without one — everything below this app's config
screen (auth, database, realtime) needs to be set up by you and tested on
your own devices. Here's exactly how:

1. **Create a free Supabase project** at [supabase.com](https://supabase.com)
   (any region is fine).
2. **Run the schema.** In the Supabase dashboard, go to *SQL Editor -> New
   query*, paste in the contents of `supabase/schema.sql` from this folder,
   and run it. This creates the `budget_entries` / `budget_settings` tables,
   the Row-Level Security policies, and enables realtime on both tables.
3. **Turn off email confirmation for this prototype** (optional, but simplest
   for a single shared family login): *Authentication -> Providers -> Email ->
   toggle off "Confirm email"*. Otherwise the account needs to click a
   confirmation link before it can sign in.
4. **Copy your project's API keys.** *Project Settings -> API* — you need the
   **Project URL** and the **anon / publishable key** (not the `service_role`
   key — never put that in a client app).
5. **Configure this app.** Copy `.env.example` to `.env` in this folder and
   fill in the two values:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
   ```
6. **Install and run:**
   ```bash
   npm install
   npm test        # pure budget-math tests, unchanged from the offline app
   npm run web     # open in a browser
   npx expo start  # scan the QR code with Expo Go on your phone
   ```
7. On first launch you'll see **"Not connected yet"** if the `.env` values
   are missing, or the **sign-in screen** once they're set. Tap "Create one",
   enter the one email/password the whole family will share, and you're in.
   Open the same app on a second device (or a second browser tab) and sign in
   with the same login — logging a purchase on one should appear on the other
   within about a second.

## Layout

```
src/
  config.ts             Reads EXPO_PUBLIC_SUPABASE_* env vars
  lib/
    supabase.ts          Supabase client (AsyncStorage-backed session storage)
    budget.ts, money.ts, dates.ts   Same pure logic as the offline app, unchanged
  store/useBudget.tsx    Auth + Supabase reads/writes + realtime subscription
  screens/
    SignInScreen.tsx      Shared-login sign in / sign up
    NotConfiguredScreen.tsx  Shown until .env is filled in
    DashboardScreen.tsx   Trimmed dashboard (no import button, no history)
  components/            Same UI components as the offline app, unchanged
  theme/theme.ts          Same design system, unchanged
supabase/schema.sql      Run once in the Supabase SQL editor
```

Money is stored and computed in **integer cents** throughout, same as the
offline app.

## What this proves / doesn't prove

Proves: the existing Dashboard UI can run unmodified against a networked,
multi-device-synced store with realistic auth — the core architecture for
"desktop or mobile, always in sync" works with this stack.

Doesn't prove: production-readiness. There's no household/multi-user model
(everyone shares one login), no offline-write queue (writes fail silently if
the network drops mid-request rather than queuing for later), and no tests
against a real Supabase project (I verified the code compiles, typechecks,
and renders correctly including the "not configured" and sign-in states —
but the actual live-sync behavior needs to be checked on your own project,
per the steps above).
