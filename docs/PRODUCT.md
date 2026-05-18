# Product

What the app does today. For *how* it's built, see [`ARCHITECTURE.md`](./ARCHITECTURE.md). For setup and run instructions, see the [`README`](../README.md).

## Vision

A mobile-first web app for tracking habits across multiple unauthenticated users on the same instance. Habits fall into three archetypes — **Workout**, **Writing**, **Custom** — and are logged with type-specific fields. The app surfaces top habits by frequency for the last week, last 30 days, and last 3 months, plus per-habit GitHub-style heatmaps and CSV export. No goals, no targets — only raw counts. The user draws their own conclusions.

The visual identity is **"Quiet Discipline"** — an editorial, warm-paper aesthetic with a deep moss-green primary accent, ember red for negative signals, and a Fraunces serif paired with Geist sans. The full design system (tokens, typography, rules) lives in [`DESIGN.md`](./DESIGN.md) — read it before adding UI.

## Navigation

- Three routes: **Home** (`/`), **Metrics** (`/metrics`), **Settings** (`/settings`)
- Mobile-friendly sticky header. On Home it shows the log-entry button and nav icons (Metrics, Settings); on other routes it shows a back arrow
- A user switcher appears in the header automatically once a second user is created
- The active user persists across reloads; first user created is the default; deleting the default promotes the next user

## Settings

- **User management**: add, rename inline, delete, mark one as default
- **Language**: English or Spanish — shared across all users, default English. Drives UI strings and date/number formatting
- **Currency**: curated dropdown (EUR, USD, GBP, JPY, CHF, CAD, AUD) — shared across all users, default EUR. Used for the "Cost spent" field on negative custom habits
- **Habit definitions**: per-user list grouped by archetype. Add/edit/delete via modal. The "positive" toggle is only meaningful for Custom habits; the type selector is locked once entries exist
- **Per-user seeding**: each new user starts with eight example habits (running, rowing, writing, reading, meat consuming, fast food consuming, cooking, social interactions), using rotating positive-palette colors (red is reserved for negative habits)

## Logging entries

A `+` button in the header opens a modal with:

- a habit picker (alphabetical)
- a mobile-friendly date picker — defaults to today, supports backfill, bounded by today
- dynamic fields per archetype:
  - **Workout**: duration, distance, weight, repetitions, notes
  - **Writing**: words, time
  - **Custom**: repetitions, cost spent, duration

The button stays disabled until there is an active user **and** at least one habit definition. Entries can be edited (habit locked, date and data editable) or deleted (with confirmation).

## Home

- Weekly stacked bar chart of entries per day for the current week (Mon–Sun)
- Recent entries list with infinite scroll (15 per page, newest first). Each row shows a habit-colored dot, the habit name, the archetype label, date, and logged data
- A habit filter at the top — ordered by most active over the last 13 weeks — drives both the chart and the entries list

## Metrics

- **Summary score cards** for the last 30 days: most-logged habit, least-logged habit (zero-entry habits can win this), total cost across negative habits, and number of active habits (with an "of N total" hint). Two cards per row on mobile, four on larger screens
- **Stacked bar chart** of entries by individual habit over the last 13 weeks, using each habit's color
- **One heatmap per habit** over the last 26 weeks — a 26×7 grid where opacity reflects per-day count. Positive habits use their assigned color, negative habits use ember. Habits with no entries still render an empty grid. Habits are ordered by their most recent in-range entry (empty habits sink to the bottom)
- **CSV export**, collapsed behind a chevron toggle: pick user and date range, then download `habits-{user}-{from}-{to}.csv` with one row per entry (columns not applicable to the archetype are blank)

## Counting rules

- Metrics count **repetitions, not entries**. For Workout and Custom habits the repetitions field is summed; entries without a repetitions field — and all Writing entries — count as one
- "Bad habit" total cost only includes Custom habits — only Custom can be negative

## Periods

- **Week** starts Monday
- **Month** = rolling 30 days
- **Year view** is the last 3 months only — a full year doesn't fit a phone screen

## Product decisions worth knowing

Intentional constraints settled during scoping, not omissions:

- **No login/registration** — users are just names on a list
- **No goals or targets** — metrics are raw counts only
- **No categories** — cut from MVP scope to keep the data model lean
- **No automated insights** — analysis is manual; the app surfaces numbers, not recommendations
- **No PWA in v1** — installability and offline support are deferred
- **Habit type cannot change** once entries exist (data integrity)
- **Habit definitions cannot be deleted** if entries exist (data integrity)
- **Habits are per-user**; **users** are the only globally shared entity
- **Settings (language, currency) are global**, shared across all users
