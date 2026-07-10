# Clover Budget

A monthly family budget tracker (Expo / React Native, TypeScript). Log spending
against eight flexible categories and see how you track toward two financial
phases:

- **Phase 1 — Breakeven:** flexible spending capped at **$2,390/month**
- **Phase 2 — Breakeven + $500 saved:** caps tighten to **$1,890/month**

## Features (MVP)

- **Dashboard** — month + amount remaining, the **runway bar** (total flexible
  spend vs cap, green when on pace, red when spending ahead of the month), and a
  per-category list with progress bars (green → amber at 85% → red over cap).
- **Phase switcher** — flip between Phase 1 and Phase 2; every cap updates
  instantly and the choice is persisted.
- **Log a purchase** — pick a category, enter an amount and optional note; edit
  or delete entries.
- **History** — roll the month into history; past months keep their totals and
  "savings achieved" (Phase 2 targets $500; every dollar under/over the cap
  adjusts it).
- **About the plan** — reference view of fixed costs, income, and subscriptions
  (not tracked in the MVP).
- **Offline** — all data in AsyncStorage. No accounts, no network.

## Running it

```bash
npm install
npm test              # 27 pure-logic tests (caps, pace, phase, rollover, savings)
npm run web           # open in a browser to eyeball the UI
npx expo run:ios      # build to the iOS Simulator (needs a Mac + Xcode)
```

To ship to a device / TestFlight, use EAS the same way as MacroTracker
(`eas build --platform ios`).

## Layout

```
src/
  data/seed.ts          Categories, caps, fixed costs, subscriptions (from budget_data.json)
  lib/
    budget.ts           Pure cap / pace / savings / rollover math (unit-tested)
    money.ts            Cents <-> dollar formatting & parsing
    dates.ts            Month keys and month-position math
  store/useBudget.tsx   State + AsyncStorage persistence
  components/           RunwayBar, CategoryRow, ProgressBar, PhaseSwitcher, LogPurchase, ui
  screens/              Dashboard, History, About
  theme/theme.ts        All colors, type, and metrics
  __tests__/            budget.test.ts
```

Money is stored and computed in **integer cents** throughout; only the display
layer converts to dollars.
