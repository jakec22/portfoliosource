# CLAUDE.md — Clover Budget

Expo / React Native (TypeScript) app for a two-phase family budget. Sibling to
MacroTracker in this portfolio; same toolchain (Expo SDK 56, EAS for iOS).
Full product requirements in `PROJECT_SPEC.md`; seed data in `budget_data.json`.

> Note: `PROJECT_SPEC.md` was originally written for a native SwiftUI build.
> The app is intentionally Expo/React Native instead, to match MacroTracker and
> the `BudgetTracker_reference.jsx` design. Treat the spec's *product* and
> *design* sections as the source of truth; ignore its Swift/SwiftData/Xcode
> engineering notes.

## Commands
- Install: `npm install`
- Test (pure logic): `npm test`
- Typecheck: `npx tsc --noEmit`
- Run on iOS: `npx expo run:ios` (needs a Mac + Xcode)
- Run in browser to eyeball UI: `npm run web`
- Static web build: `npx expo export --platform web` (outputs `dist/`)

## Stack
- Expo SDK 56, React Native 0.85, React 19, TypeScript
- Persistence: AsyncStorage (offline, no accounts, no network)
- Native modules: expo-linear-gradient, async-storage, expo-document-picker,
  `expo-file-system/legacy` (the default `expo-file-system` export moved to a
  new File/Directory class API in this SDK — the classic `readAsStringAsync`
  lives at the `/legacy` subpath), expo-secure-store

## AI statement import
- Bring-your-own-key: the user's Anthropic API key is entered once and stored
  via `expo-secure-store` (`src/lib/apiKey.ts`), never bundled or sent
  anywhere but `api.anthropic.com`. No backend.
- Calls the Messages API via raw `fetch` (`src/lib/claudeImport.ts`), not the
  `@anthropic-ai/sdk` package — that SDK targets Node/browser and doesn't
  bundle cleanly into React Native/Hermes.
- One-shot structured-output extraction (`output_config.format` json_schema),
  not an agentic loop — model `claude-haiku-4-5`.
- Re-import dedupe: Claude re-parses the whole statement every time (no
  memory of prior imports). Before entries are added, each parsed transaction
  is fingerprinted (date + amount + normalized merchant text) against
  `state.entries` — see `src/lib/importDedupe.ts`. Matches are pre-unchecked
  and labeled "Already imported" on the review screen but always stay
  user-overridable, never silently hidden.
- `expo-secure-store`'s web shim is incomplete in this SDK (no
  `getValueWithKeyAsync`) — real usage is native-only (Expo Go/iOS/Android).
  Key load/save failures are caught and degrade to the key-entry/error step
  rather than crashing; this was verified by exercising the failure path on
  the web build, not by SecureStore actually working there.

## Conventions
- **Money is integer cents everywhere.** Only `src/lib/money.ts` converts to
  dollars for display. Never do float dollar math.
- All displayed figures use `<AppText mono>` (tabular monospaced digits).
- Colors and type live in `src/theme/theme.ts` only — never hardcode a hex at a
  call site.
- Cap / pace / savings / rollover math is pure and lives in `src/lib/budget.ts`,
  unit-tested in `src/__tests__/budget.test.ts`. Views must not re-derive it.
- Months are keyed `"YYYY-MM"`; boundaries computed in the device's local
  calendar (see `src/lib/dates.ts`).

## Design guardrails
- **Executive / sleek / monochromatic (graphite).** Achromatic palette — no hue
  anywhere except one: a muted terracotta (`Colors.warning`) reserved strictly
  for over-budget / over-cap (and negative savings / input error). Otherwise
  status is shown by *tone* (brightness) and weight — a bar/figure grows
  brighter as it fills toward its cap, then turns terracotta once over. This
  intentionally supersedes the green/amber/red DESIGN section of
  `PROJECT_SPEC.md` (kept for product reference only) — do not reintroduce the
  green or any other accent hue unless the user asks.
- Type is the platform system grotesk (SF Pro on iOS), no rounded face. Large
  display figures use a light weight with tight tracking; every amount uses
  tabular figures via `<AppText mono>`.
- Dark theme only. The runway bar (total spend vs total cap, tone by pace) is
  the signature element.

## Don't
- Don't rename categories or change caps — they come from a real financial plan.
- Don't add features outside the spec (no bank sync, no charts beyond bars, no
  notifications) unless asked.
- When fixing a reported bug, add a regression test alongside the fix.
