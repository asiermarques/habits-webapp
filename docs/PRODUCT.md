# Product Status

This document describes **what the app actually does today**, not what it's planned to do.

## Vision (one paragraph)

A mobile-first web app for tracking habits across multiple unauthenticated users on the same instance. Habits fall into three archetypes (**Workout**, **Writing**, **Custom**) and are logged with type-specific fields. The app surfaces top habits by frequency for the last week, last 30 days, and last 3 months, plus per-habit GitHub-style heatmaps and CSV export. No goals, no targets — only raw counts of how many times a habit was done (repetitions are summed; entries without a repetitions field count as one). The user draws their own conclusions.


## Features available

- **Three navigable routes**: `/` (Home), `/metrics`, `/settings`
- **Mobile-friendly header** with route-conditional navigation (icons on Home, back arrow elsewhere)
- **End-to-end connectivity**: Home calls the backend's `/health` endpoint via TanStack Query and renders the live API status
- **User management** in Settings: add users, rename inline, delete, mark one as default
- **Active user persists** across reloads via `localStorage`; the first created user is auto-set as default; deleting the default promotes the next user
- **Header user switcher** appears automatically when more than one user exists
- **Global currency setting** in Settings (above the habit list): a curated dropdown (EUR, USD, GBP, JPY, CHF, CAD, AUD) shared across all users; default EUR. Used for the "Cost spent" field on bad habits — surfaces in the entries list (`cost N EUR`), the Cost-spent form label (`Cost spent (EUR)`), and the "Bad habit total cost" score card
- **Habit definitions management** in Settings: list grouped by type (Workout / Writing / Custom), add/edit/delete via a modal form, positive toggle visible only for Custom habits, type selector locked once entries exist. **Habits are per-user** — each user manages their own list
- **Per-user seeding**: when a new user is created, eight example habits are auto-inserted for that user (running, rowing, writing, reading, meat consuming, fast food consuming, cooking, social interactions) with rotating colors from a positive palette (red reserved for negative habits)
- **Log entries**: a `+` icon in the sticky header opens a modal with habit picker (alphabetical), date picker (defaults to today, supports backfill), and dynamic fields per habit type (Workout: duration/distance/weight/repetitions/notes; Writing: words/time; Custom: repetitions/cost spent/duration). The icon is disabled until there is an active user and at least one habit definition
- **Recent entries list** on Home with cursor-based infinite scroll ("Load more" button), sorted newest-first by date. Each card shows the habit name, a small type badge (`workout` / `writing` / `custom`), and a summary line with date and logged data. Home has its own habit filter at the top of the page, shared between the weekly chart and the entries list
- **Edit and delete entries**: edit reuses the same modal pre-filled (habit locked, date and data editable); delete shows a confirmation dialog
- **Habit-definition guards now active**: a definition with existing entries cannot be deleted (409) and its type cannot be changed (409)
- **Home weekly chart**: the Home screen shows a full-width Nivo stacked bar chart of entries per day for the current week (Mon–Sun), reacting to the same habit filter as the entries list
- **Metrics page**: dedicated `/metrics` view. It contains:
  - **Summary score cards** for the last 30 days: most-logged habit, least-logged habit (zero-entry habits can win this card), total cost (sum of the `amount` field) across negative ("bad") habits, and number of active habits (with a "of N total" hint). Two cards per row on mobile, four per row on `md+`
  - A stacked bar chart of entries by individual habit over the last 13 weeks (Mon–Sun aligned, ~3 months), using each habit's assigned color
  - One heatmap per habit definition over the last 26 weeks (~6 months) — a 26×7 grid where opacity indicates the per-day count. On `md+` viewports cards are arranged in two columns; cells fill the available width via CSS grid. Positive habits use their assigned color, negative habits use red. Habits with no entries still render an empty grid. Habits are ordered by their most recent in-range entry (newest first); empty habits sink to the bottom
  - **CSV export** at the top of the Metrics page, collapsed behind a chevron toggle: expand it to pick user + from/to dates, click Export, the browser downloads `habits-{user}-{from}-{to}.csv` with one row per entry and a unified set of columns (data fields not applicable to an archetype are blank)

## What does not work yet

_All planned slices are implemented._

## Product decisions worth knowing

These were settled during scoping and are intentional design constraints, not omissions:

- **No login/registration** — users are just names on a list
- **No goals or targets** — metrics are raw counts only
- **Metrics count repetitions, not entries** — for workout and custom habits the `number` (repetitions) field is summed; writing entries and entries without a `number` count as one
- **No categories** — explicitly cut from MVP scope to keep the data model lean
- **No automated insights** — analysis is manual; the app surfaces numbers, not recommendations
- **No PWA in v1** — installability and offline support are deferred
- **Habit type cannot change** once entries exist for a definition (data integrity)
- **Habit definitions cannot be deleted** if entries exist (data integrity)

## Implementation status

| Slice | Status | What it delivers |
|---|---|---|
| 0 — Foundation | ✅ Done | Both apps run, navigate, and talk to each other |
| 1 — Users | ✅ Done | Manage user names, default user, header switcher |
| 2 — Habit Definitions | ✅ Done | CRUD for habit definitions + seeded examples |
| 3 — Log Entry + List | ✅ Done | Core logging loop with infinite-scroll history |
| 4 — Home Metrics Summary | ✅ Done | Home weekly stacked-bar chart (Mon–Sun) with habit filter |
| 5 — Metrics View | ✅ Done | Bar charts and heatmaps over the last 3 months |
| 6 — CSV Export | ✅ Done | Date-ranged export per user |

## Periods

- **Week** starts Monday
- **Month** = rolling 30 days
- **Year view** = last 3 months only (a full year doesn't fit a phone screen)

## How to try the implemented features

```bash
npm install
npm run dev
```

Visit `http://localhost:5173`. The Home page should show "ok: true" if the API is reachable.
