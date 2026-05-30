# Product

What the app does today. For *how* it's built, see [`ARCHITECTURE.md`](./ARCHITECTURE.md). For setup and run instructions, see the [`README`](../README.md).

## Vision

A mobile-first web app for tracking habits across multiple unauthenticated users on the same instance. Habits fall into three archetypes — **Workout**, **Writing**, **Custom** — and are logged with type-specific fields. The app surfaces top habits by frequency for the last week, last 30 days, and last 3 months, plus per-habit GitHub-style heatmaps, CSV export, and JSON backup/restore. No goals, no targets — only raw counts. The user draws their own conclusions.

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
- **Your data** area, shown only when an Active User is selected, groups two data-egress controls:
  - **Backup & restore**, collapsed behind a chevron toggle: **export** the active user's habit definitions and entries as a single JSON file, or **import** one back. Import merges — it adds definitions/entries that aren't already present and skips duplicates (a definition matching by name, an entry matching by habit + date), so re-importing the same file is safe. Colors round-trip; ids do not (entries reference their definition by name, so a backup restores cleanly into a different instance)
  - **Export CSV**, collapsed behind a chevron toggle: pick a date range, then download `habits-{user}-{from}-{to}.csv` with one row per entry (columns not applicable to the archetype are blank). For analysis only — not a backup, habit definitions are not included, and the file cannot be re-imported

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


## Counting rules

- Metrics count **repetitions, not entries**. For Workout and Custom habits the repetitions field is summed; entries without a repetitions field — and all Writing entries — count as one
- "Bad habit" total cost only includes Custom habits — only Custom can be negative

## Periods

- **Week** starts Monday
- **Month** = rolling 30 days
- **Year view** is the last 3 months only — a full year doesn't fit a phone screen

## Product decisions worth knowing

Intentional constraints settled during scoping, not omissions:

- **No login/registration** — users are just names on a list. The optional instance password gate (below) is a separate, instance-level concern and does not change this: there are still no accounts, and switching user remains a client-side pick
- **Optional instance password gate** — for public deployments, a single shared password (set via the `GATE_PASSWORD` env var) puts the whole instance behind an unlock screen. It's an operational deployment safeguard, *not* per-user authentication — one password unlocks everything equally, with no usernames, accounts, or roles. Unlocking lasts ~24h per browser (a signed, HTTP-only cookie). When `GATE_PASSWORD` is unset (local dev, tests), the gate is disabled and the app behaves exactly as before
- **No goals or targets** — metrics are raw counts only
- **No categories** — cut from MVP scope to keep the data model lean
- **No automated insights** — analysis is manual; the app surfaces numbers, not recommendations
- **Installable PWA, read-only offline** — the app ships a web manifest and a service worker, so it installs to the home screen and opens offline. A dismissible in-app prompt offers installation on Android/Chrome and shows manual "Add to Home Screen" guidance on iOS Safari (it never nags — hidden once installed or dismissed). The app shell is precached and previously-viewed API reads (Home, Metrics) are served from cache when the network is down, preferring fresh data when online. A newly deployed build reaches installed users via an in-app "refresh to update" prompt. **Offline writes are a permanent non-goal** — logging, editing, and deleting entries always require a connection; attempting one offline fails with a clear "you're offline" message and is never shown as saved. When the optional instance gate is enabled, cached API data is not served offline (the unlock screen is shown instead) and is evicted on logout, so caching never weakens the gate
- **Habit type cannot change** once entries exist (data integrity)
- **Habit definitions cannot be deleted** if entries exist (data integrity)
- **Habits are per-user**; **users** are the only globally shared entity
- **Settings (language, currency) are global**, shared across all users
