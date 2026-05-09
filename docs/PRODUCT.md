# Product Status

This document describes **what the app actually does today**, not what it's planned to do.

## Vision (one paragraph)

A mobile-first web app for tracking habits across multiple unauthenticated users on the same instance. Habits fall into three archetypes (**Workout**, **Writing**, **Custom**) and are logged with type-specific fields. The app surfaces top habits by frequency for the last week, last 30 days, and last 3 months, plus per-habit GitHub-style heatmaps and CSV export. No goals, no targets — only raw counts. The user draws their own conclusions.

## Implementation status

| Slice | Status | What it delivers |
|---|---|---|
| 0 — Foundation | ✅ Done | Both apps run, navigate, and talk to each other |
| 1 — Users | ✅ Done | Manage user names, default user, header switcher |
| 2 — Habit Definitions | Planned | CRUD for habit definitions + seeded examples |
| 3 — Log Entry + List | Planned | Core logging loop with infinite-scroll history |
| 4 — Home Metrics Summary | Planned | Top habits and totals on Home |
| 5 — Metrics View | Planned | Bar charts and heatmaps |
| 6 — CSV Export | Planned | Date-ranged export per user |

## What works right now

- **Three navigable routes**: `/` (Home), `/metrics`, `/settings`
- **Mobile-friendly header** with route-conditional navigation (icons on Home, back arrow elsewhere)
- **End-to-end connectivity**: Home calls the backend's `/health` endpoint via TanStack Query and renders the live API status
- **User management** in Settings: add users, rename inline, delete, mark one as default
- **Active user persists** across reloads via `localStorage`; the first created user is auto-set as default; deleting the default promotes the next user
- **Header user switcher** appears automatically when more than one user exists

## What does not work yet

- No habit definitions — nothing to log
- No log button, no log form, no entries list
- Metrics page is placeholder text
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
