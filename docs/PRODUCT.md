# Product Status

This document describes **what the app actually does today**, not what it's planned to do.

## Vision (one paragraph)

A mobile-first web app for tracking habits across multiple unauthenticated users on the same instance. Habits fall into three archetypes (**Workout**, **Writing**, **Custom**) and are logged with type-specific fields. The app surfaces top habits by frequency for the last week, last 30 days, and last 3 months, plus per-habit GitHub-style heatmaps and CSV export. No goals, no targets — only raw counts. The user draws their own conclusions.

## Implementation status

| Slice | Status | What it delivers |
|---|---|---|
| 0 — Foundation | ✅ Done | Both apps run, navigate, and talk to each other |
| 1 — Users | ✅ Done | Manage user names, default user, header switcher |
| 2 — Habit Definitions | ✅ Done | CRUD for habit definitions + seeded examples |
| 3 — Log Entry + List | ✅ Done | Core logging loop with infinite-scroll history |
| 4 — Home Metrics Summary | ✅ Done | Top habits and totals on Home |
| 5 — Metrics View | ✅ Done | Bar charts and heatmaps over the last 3 months |
| 6 — CSV Export | Planned | Date-ranged export per user |

## What works right now

- **Three navigable routes**: `/` (Home), `/metrics`, `/settings`
- **Mobile-friendly header** with route-conditional navigation (icons on Home, back arrow elsewhere)
- **End-to-end connectivity**: Home calls the backend's `/health` endpoint via TanStack Query and renders the live API status
- **User management** in Settings: add users, rename inline, delete, mark one as default
- **Active user persists** across reloads via `localStorage`; the first created user is auto-set as default; deleting the default promotes the next user
- **Header user switcher** appears automatically when more than one user exists
- **Habit definitions management** in Settings: list grouped by type (Workout / Writing / Custom), add/edit/delete via a modal form, positive toggle visible only for Custom habits, type selector locked once entries exist
- **First-run seeding**: on a fresh database, eight example habits are auto-inserted (running, rowing, writing, reading, meat consuming, fast food consuming, cooking, social interactions) with rotating colors from a positive palette (red reserved for negative habits)
- **Log entries** from Home: prominent Log button opens a modal with habit picker (alphabetical), date picker (defaults to today, supports backfill), and dynamic fields per habit type (Workout: duration/distance/weight/amount/notes; Writing: words/time; Custom: number/amount/duration/binary)
- **Recent entries list** on Home with cursor-based infinite scroll ("Load more" button), sorted newest-first by date. The habit filter is shared with the weekly chart and lives directly under the Log button
- **Edit and delete entries**: edit reuses the same modal pre-filled (habit locked, date and data editable); delete shows a confirmation dialog
- **Habit-definition guards now active**: a definition with existing entries cannot be deleted (409) and its type cannot be changed (409)
- **Home weekly chart**: the Home screen shows a full-width Nivo stacked bar chart of entries per day for the current week (Mon–Sun), reacting to the same habit filter as the entries list
- **Metrics page**: dedicated `/metrics` view. It contains:
  - A stacked bar chart of entries by archetype (Workout / Writing / Custom) over the last 13 weeks (Mon–Sun aligned, ~3 months)
  - One heatmap per habit definition over the last 26 weeks (~6 months) — a 26×7 grid where opacity indicates the per-day count. On `md+` viewports cards are arranged in two columns; cells fill the available width via CSS grid. Positive habits use their assigned color, negative habits use red. Habits with no entries still render an empty grid

## What does not work yet

- No data export

## Product decisions worth knowing

These were settled during scoping and are intentional design constraints, not omissions:

- **No login/registration** — users are just names on a list
- **No goals or targets** — metrics are raw counts only
- **No categories** — explicitly cut from MVP scope to keep the data model lean
- **No automated insights** — analysis is manual; the app surfaces numbers, not recommendations
- **No PWA in v1** — installability and offline support are deferred
- **Habit type cannot change** once entries exist for a definition (data integrity)
- **Habit definitions cannot be deleted** if entries exist (data integrity)

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
