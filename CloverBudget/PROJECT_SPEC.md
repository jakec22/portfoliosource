# PROJECT_SPEC.md — Clover Family Budget (iOS)

## Prompt to give Claude Code

Paste this as your first message after running `claude` in the project folder:

> Build a native iOS app in SwiftUI called "Clover Budget" following PROJECT_SPEC.md
> in this folder. Use budget_data.json as the seed data. Match the visual design
> described in the DESIGN section exactly — it's based on a web app I already like.
> Start with a working MVP: dashboard + category caps + logging spend against
> categories, persisted locally with SwiftData. Build it, run it in the iOS
> Simulator, and show me before adding anything else.

---

## What this app is

A monthly budget tracker for a family working toward two financial phases:

- **Phase 1 — Breakeven:** flexible spending capped at $2,390/month
- **Phase 2 — Save $500/month:** flexible spending capped at $1,890/month

The user logs spending against 8 flexible categories over the month. The app
shows how each category tracks against its cap for the *active phase*, and
whether overall spend pace is on track for where they are in the month.

## Core features (MVP)

1. **Dashboard screen**
   - Header: month name, amount remaining across all flexible categories
     (or amount over, in red)
   - **Runway bar**: a horizontal bar showing total flexible spend vs total cap,
     with a vertical marker at today's position in the month
     (day 12 of 31 → marker at ~39%). Bar is green when spend% ≤ month%,
     red when spending ahead of pace. Label: "On pace" / "Ahead of pace"
   - Category list: each category shows name, spent vs cap, a thin progress bar
     (green → amber at 85% of cap → red when over), and remaining amount

2. **Phase switcher**
   - A control (segmented or in settings) to flip between Phase 1 and Phase 2
   - All caps update instantly; persist the selection

3. **Log a purchase**
   - Category picker, amount, optional note, date (defaults today)
   - Fast entry — 3 taps max to log a typical purchase
   - Entries editable and deletable

4. **Month rollover**
   - Each month starts fresh; prior months are kept as history
   - History screen: past months with total spent vs cap, over/under,
     and "savings achieved" for Phase 2 months (500 − overage, or 500 + underspend)

5. **Persistence**: SwiftData (or Core Data), fully offline, no accounts, no network.

## Post-MVP (only after MVP works)

- Widgets: lock-screen / home-screen widget showing runway bar
- Recurring subscription checklist (seeded from budget_data.json subscriptions)
- CSV export of a month's entries
- Face ID lock toggle

## Data model (see budget_data.json)

- `Category`: id, name, hint, phase1Cap, phase2Cap
- `Entry`: id, categoryId, amount, note, date
- `MonthRecord`: month, phase, computed totals
- `Settings`: activePhase (1 or 2)

Seed the 8 categories and both phase caps from budget_data.json on first launch.
Fixed costs and income are reference data shown on an "About the plan" screen —
they are not tracked or editable in the MVP.

## DESIGN — match this exactly

The user has an existing web app whose style they like. Reproduce it:

**Palette (dark theme, the app's only theme for MVP):**
- Background: `#10151F`
- Card / surface: `#161D2A`, border `#232B3A`
- Deep header background: `#0B0F16`
- Text primary: `#E8EBF0`, secondary `#B9C1D0`, muted `#8A93A6`, faint `#69738A`
- Accent green (success/on-pace/CTA): `#5FD4A8`, darker gradient pair `#2E8C6A`
- Warning amber: `#E8B44F`
- Over-budget red: `#F0647A`, darker gradient pair `#B03A50`
- Input field background: `#0B0F16` with border `#2C3547`

**Type:**
- UI text: rounded-geometric sans. Use SF Pro Rounded (system, no licensing issues)
  as the equivalent of the web app's Space Grotesk
- ALL numbers/amounts: monospaced digits (`.monospacedDigit()` or SF Mono) —
  the web app uses IBM Plex Mono for every figure; keep that tabular feel

**Components:**
- Cards: 10pt corner radius, 1pt border `#232B3A`, background `#161D2A`
- Progress bars: 8pt tall, 4pt radius, track `#0B0F16`
- The runway bar: 26pt tall, 6pt radius, fill is a horizontal gradient
  (green pair when on pace, red pair when not), white 2pt day marker line,
  centered label in monospaced type with subtle shadow
- Status accents: eyebrow labels in uppercase, letter-spaced, 11pt, `#5FD4A8`
- Buttons: filled `#5FD4A8` with dark text `#0B0F16`, bold, 8pt radius
- Respect Reduce Motion; animate bar width changes ~0.4s ease otherwise

**Tone of copy:** plain, direct, sentence case. "Log a purchase", "left this
month", "Ahead of pace". No exclamation marks, no finance jargon.

## Engineering requirements

- SwiftUI, iOS 17+, Swift 5.9+
- SwiftData for persistence
- No third-party dependencies for MVP
- Unit tests for: cap math, pace calculation, phase switching, month rollover,
  savings-achieved formula
- Accessibility: Dynamic Type support, VoiceOver labels on bars
  ("Dining, 84 dollars of 200 dollar cap, 42 percent")

## Definition of done (MVP)

- Builds clean in Xcode, runs on iOS Simulator
- Can: switch phases, log/edit/delete entries, see accurate bars & pace,
  roll to a new month keeping history
- All unit tests pass
