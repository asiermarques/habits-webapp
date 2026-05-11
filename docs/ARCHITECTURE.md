# Architecture

This document describes the **current implemented state** of the codebase.

## Domain model

Three core entities. **User** and **HabitDefinition** are implemented; **HabitEntry** lands in Slice 3.

```
User (1) ─────┐
              ├──< HabitEntry >── (N) HabitDefinition
              │                         │ type: workout | writing | custom
              │                         │
              │                         └─ has one type-specific payload:
              │                            WorkoutData | WritingData | CustomData
              │
              └─ "active user" is selected one at a time on the client
```

### User — implemented

| Field | Type | Notes |
|---|---|---|
| `id` | integer PK | autoincrement |
| `name` | text | display name |
| `isDefault` | boolean | exactly one user is the default at any time |
| `createdAt` | text | timestamp |

Invariants enforced in `backend/src/users/repository.ts` (all run inside transactions):
- The first user created is automatically default
- Setting a user as default un-sets all others
- Deleting the default promotes the next-oldest user
- The last remaining user cannot be deleted → HTTP 409

### HabitDefinition — implemented

A per-user catalogue of habits. Each user manages their own list; users are the only globally-shared entity.

| Field | Type | Notes |
|---|---|---|
| `id` | integer PK | autoincrement |
| `userId` | integer FK → users.id | owner; cascade-deletes with the user |
| `name` | text | display name |
| `type` | enum | `workout` \| `writing` \| `custom` |
| `positive` | boolean | direction; drives metric framing and heatmap color |
| `color` | text | hex; auto-assigned at creation |
| `createdAt` | text | timestamp |
| `hasEntries` | boolean | response-only; computed via `hasEntriesForDefinition`. Drives the UI's type-lock and delete-block affordances |

Invariants enforced in `backend/src/habit-definitions/repository.ts`:
- Definitions are scoped per `userId`: `GET /habit-definitions?userId=` returns only that user's habits, and `POST` requires a `userId` in the body
- Workout and Writing are **always** positive (`positive` is forced to true regardless of input)
- Custom is the only type with a meaningful `positive` flag
- Color is auto-assigned at creation:
  - Negative → red (`#ef4444`)
  - Positive → next color in the rotating 8-color palette, based on the count of existing positive habits **for that user**
- Type cannot change once entries reference the definition → HTTP 409
- Definitions with existing entries cannot be deleted → HTTP 409
- The last two checks call `hasEntriesForDefinition(id)` (in `entries/repository.ts`) which counts rows in the `entries` table for that definition; both rules are enforced as of Slice 3
- Entry creation rejects with HTTP 403 if the supplied `habitDefinitionId` belongs to a different user than the entry's `userId`

### HabitEntry — implemented

A single logged occurrence of a habit by a specific user on a specific date. Multiple entries for the same `(user, definition, date)` are allowed.

| Field | Type | Notes |
|---|---|---|
| `id` | integer PK | |
| `habitDefinitionId` | integer FK | references HabitDefinition |
| `userId` | integer FK | references User |
| `date` | text | `d-m-Y` |
| `createdAt` | text | timestamp |

The data fields are split into a child table per archetype so each row only carries its valid columns:

**WorkoutData** (`entry_workout_data`)
| Field | Required |
|---|---|
| `duration` | yes |
| `distance` | optional |
| `weight` | optional |
| `number` | optional (repetitions; UI label "Repetitions") |
| `notes` | optional |

**WritingData** (`entry_writing_data`)
| Field | Required |
|---|---|
| `words` | yes |
| `time` | optional |

**CustomData** (`entry_custom_data`)
| Field | Required |
|---|---|
| `number` | optional (UI label "Repetitions") |
| `amount` | optional (UI label "Cost spent") |
| `duration` | optional |

(`name` and `positive` for Custom live on the parent HabitDefinition, not on the entry.)

### Cross-cutting rules

- **No goals or targets** — metrics are raw counts only
- **No categories** — explicitly cut from MVP scope
- **Habit definitions are global**, not per-user
- **Active user is selected one at a time** on the client; persisted in `localStorage`; metrics are always single-user
- **Periods**: week starts Monday; month = rolling 30 days; Metrics view = last 3 months

## Repository layout

npm workspaces monorepo with three packages:

```
habitsapp/
├── backend/                Express API
│   ├── src/
│   │   ├── app.ts          createApp() factory (Express setup, mounts routers)
│   │   ├── index.ts        bootstrap (runs migrations, calls listen)
│   │   ├── db/
│   │   │   ├── index.ts    Drizzle connection (better-sqlite3)
│   │   │   ├── migrate.ts  programmatic migration runner
│   │   │   └── schema.ts   table definitions
│   │   ├── users/          Slice 1: users feature
│   │   │   ├── repository.ts  CRUD against the users table (transactions); createUser also triggers per-user habit seeding (skipped under NODE_ENV=test)
│   │   │   ├── routes.ts      Express router for /users
│   │   │   └── __tests__/
│   │   ├── habit-definitions/ Slice 2: per-user habit definitions feature
│   │   │   ├── colors.ts      positive palette + red for negative; pickColor()
│   │   │   ├── repository.ts  CRUD scoped by userId, with type-lock and delete-block (calls hasEntriesForDefinition); per-user positive-color rotation
│   │   │   ├── routes.ts      Express router for /habit-definitions (requires userId)
│   │   │   ├── seed.ts        seedHabitDefinitionsForUser(userId) inserts eight example habits for one user
│   │   │   └── __tests__/
│   │   ├── entries/        Slice 3: log entries feature
│   │   │   ├── repository.ts  cursor-paginated list, parent + child-table CRUD in transactions
│   │   │   ├── routes.ts      Express router for /entries (cursor encoded as base64url JSON)
│   │   │   └── __tests__/
│   │   ├── metrics/        Slices 4–5: metrics
│   │   │   ├── repository.ts  weekly per-day aggregation + 13-week by-type + 13-week by-habit + 26-week heatmap + 30-day summary aggregations; all sum repetitions (`COALESCE(workout.number, custom.number, 1)`) rather than counting rows
│   │   │   ├── routes.ts      Express router for /metrics/weekly, /metrics/by-type, /metrics/by-habit, /metrics/heatmap, /metrics/summary
│   │   │   └── __tests__/
│   │   ├── export/         Slice 6: CSV export
│   │   │   ├── repository.ts  joined entry rows + RFC-4180 CSV serializer
│   │   │   ├── routes.ts      Express router for /export/csv
│   │   │   └── __tests__/
│   │   ├── settings/       Global app settings (singleton key/value)
│   │   │   ├── repository.ts  get/setCurrency on app_settings table
│   │   │   ├── routes.ts      Express router for /settings + /settings/currency
│   │   │   └── __tests__/
│   │   ├── test/setup.ts   Vitest setup: in-memory DB + table reset per test (re-seeds currency default to EUR)
│   │   └── __tests__/      Vitest + supertest
│   ├── drizzle/            generated SQL migrations
│   ├── drizzle.config.ts
│   └── .env.example
├── frontend/               React SPA
│   ├── src/
│   │   ├── main.tsx        entry; mounts providers + router
│   │   ├── App.tsx         routes
│   │   ├── components/
│   │   │   ├── Header.tsx  sticky header, conditional nav, embeds UserSwitcher
│   │   │   ├── ui/         shadcn/ui primitives (Button, Input, Select, Dialog, DropdownMenu)
│   │   │   └── __tests__/
│   │   ├── users/          Slice 1: users feature
│   │   │   ├── UserContext.tsx   active user state + localStorage persistence
│   │   │   ├── UserSwitcher.tsx  header dropdown (visible only when >1 user)
│   │   │   ├── UsersSection.tsx  Settings panel (list, add, rename, set default, delete)
│   │   │   └── queries.ts        TanStack Query hooks
│   │   ├── habits/         Slice 2: habit definitions feature
│   │   │   ├── HabitForm.tsx     shared form for add and edit (modal)
│   │   │   ├── HabitsSection.tsx Settings panel grouped by type
│   │   │   ├── queries.ts        TanStack Query hooks
│   │   │   └── __tests__/
│   │   ├── entries/        Slice 3: log entries feature
│   │   │   ├── EntryForm.tsx        log/edit form with dynamic per-type fields
│   │   │   ├── LogEntryDialog.tsx   shared Log/Edit modal + provider (useLogEntryDialog hook)
│   │   │   ├── EntriesList.tsx      filterable list with infinite scroll + delete confirm
│   │   │   ├── date.ts              todayIso() + formatDate() helpers
│   │   │   ├── queries.ts           TanStack Query hooks (useInfiniteQuery; entry mutations also invalidate ['metrics'])
│   │   │   └── __tests__/
│   │   ├── metrics/        Slices 4–5: metrics
│   │   │   ├── WeekChartSection.tsx     Nivo stacked-bar chart (Mon–Sun) reacting to the home filter
│   │   │   ├── ByTypeChartSection.tsx   Nivo stacked-bar chart of entries per habit across 13 weeks with custom HTML legend (Metrics page)
│   │   │   ├── HeatmapSection.tsx       Custom 26×7 grid heatmap per habit definition (Metrics page)
│   │   │   ├── SummaryCards.tsx         Four last-30-day score cards (2 cols mobile, 4 cols md+); reads /metrics/summary
│   │   │   ├── queries.ts               useWeeklyMetrics, useByTypeMetrics, useByHabitMetrics, useHeatmapMetrics, useSummaryMetrics hooks
│   │   │   └── __tests__/
│   │   ├── export/         Slice 6: CSV export
│   │   │   ├── ExportSection.tsx        date-range form for the active user (no user picker — uses UserContext); fetches CSV blob and triggers browser download
│   │   │   └── __tests__/
│   │   ├── settings/       Global app settings (currency)
│   │   │   ├── queries.ts            useSettingsQuery + useUpdateCurrency hooks
│   │   │   └── CurrencySection.tsx   Settings page section: curated currency dropdown
│   │   ├── pages/          Home, Metrics, Settings
│   │   ├── lib/
│   │   │   ├── api.ts      apiFetch wrapper
│   │   │   ├── currency.ts formatCurrency(amount, code) → "12.50 EUR"
│   │   │   ├── utils.ts    cn() class merger
│   │   │   └── __tests__/
│   │   ├── test/
│   │   │   ├── setup.ts        Vitest + Testing Library setup
│   │   │   └── test-utils.tsx  TestProviders helper (QueryClient + Router + UserProvider)
│   │   ├── index.css       Tailwind v4 + shadcn theme variables
│   │   └── vite-env.d.ts
│   ├── components.json     shadcn config
│   ├── vite.config.ts
│   └── vitest.config.ts
└── shared/                 @habitsapp/shared
    └── src/index.ts        types shared between API and UI
```

## Backend

- **Runtime**: Node.js (ESM, `"type": "module"`)
- **Framework**: Express 4 with `cors` and `express.json()`
- **Pattern**: `createApp()` factory in `src/app.ts` separates the Express instance from the listener in `src/index.ts`. This makes the app testable via `supertest` without binding to a port.
- **Endpoints implemented**:
  - `GET /health` → `{ ok: true }`
  - `GET /users`, `POST /users`, `PUT /users/:id`, `DELETE /users/:id`
  - `GET /habit-definitions?userId=`, `POST /habit-definitions` (body must include `userId`), `PUT /habit-definitions/:id`, `DELETE /habit-definitions/:id`
  - `GET /entries?userId=&habitDefinitionId=&cursor=&limit=`, `POST /entries`, `PUT /entries/:id`, `DELETE /entries/:id`
  - `GET /metrics/weekly?userId=&habitDefinitionId=&today=` — current week (Mon–Sun) bucketed per day with sparse `counts` per habit definition. `habitDefinitionId` and `today` are optional; `today` (YYYY-MM-DD) anchors the week and is used by tests. Counts sum repetitions: workout/custom entries contribute their `number` field (repetitions) when set, otherwise the entry contributes 1.
  - `GET /metrics/by-type?userId=&today=` — repetition counts per archetype (workout/writing/custom) per week across the 13-week range (Mon–Sun aligned) that ends with the anchor week. Always returns 13 ordered weeks (oldest first), zero-filled. Same repetition-summing rule as `/metrics/weekly`.
  - `GET /metrics/by-habit?userId=&today=` — same 13-week range as `by-type`, but broken down by individual habit definition instead of archetype. Each week contains a sparse `habits: HabitCount[]` array (only habits with entries appear). Uses the same repetition-summing rule.
  - `GET /metrics/summary?userId=&today=` — last-30-day rollup for the score cards on `/metrics`: `mostRegistered`, `leastRegistered` (zero-entry habits can win and are returned with `count: 0`), `badHabitsTotalCost` (sum of `entry_custom_data.amount` across entries belonging to `positive=false` custom habits — only custom habits can be negative), and `activeHabitsCount` (distinct habits with at least one entry). Most/least use the same repetition-summing rule as the other endpoints.
  - `GET /metrics/heatmap?userId=&today=` — for every habit definition, a sparse `{ date, count }[]` over the rolling 26-week range (~6 months, Mon–Sun aligned) that ends with the anchor week. `count` is the per-day sum of repetitions (same rule as the other metrics endpoints). Habits are ordered by their most recent in-range entry (newest first); habits with no in-range entries are listed last with an empty `days` array.
  - `GET /export/csv?userId=&from=&to=` — returns a CSV (`text/csv; charset=utf-8`, `Content-Disposition: attachment`) with one row per entry inside the inclusive `[from, to]` window. Columns: `date, habit_name, type, positive, duration, distance, weight, amount, notes, words, time, number`. `duration` and `number` are shared across workout/custom; `amount` is custom-only. For each row only the columns that apply to its archetype are filled, the rest are empty. Text fields are RFC-4180 escaped.
  - `GET /settings`, `PUT /settings/currency` — global singleton settings (key/value table). Currency defaults to `EUR`; `PUT` accepts a body `{ currency: <code> }` validated against `SUPPORTED_CURRENCIES` (`EUR`, `USD`, `GBP`, `JPY`, `CHF`, `CAD`, `AUD`).
- **Config**: `dotenv` loads `backend/.env`. Variables: `PORT` (default 3001), `DATABASE_URL` (default `./habits.db`), `CORS_ORIGIN` (default `http://localhost:5173`).
- **Dev runner**: `tsx watch src/index.ts`

### Database layer

- **Engine**: SQLite via `better-sqlite3`
- **ORM**: Drizzle (`drizzle-orm/better-sqlite3`)
- **Connection** (`src/db/index.ts`):
  - Opens the DB file from `DATABASE_URL`
  - Applies `journal_mode = WAL` and `foreign_keys = ON`
  - Exports a `db` instance with the schema attached
- **Schema** (`src/db/schema.ts`):
  - `users` (`id`, `name`, `is_default`, `created_at`)
  - `habit_definitions` (`id`, `user_id` FK→cascade, `name`, `type` enum: workout/writing/custom, `positive`, `color`, `created_at`)
  - `entries` (`id`, `habit_definition_id` FK→restrict, `user_id` FK→cascade, `date` text, `created_at`)
  - Type-specific child tables, each with `entry_id` PK FK→cascade:
    - `entry_workout_data` — `duration` (int, required), `distance` (real), `weight` (real), `number` (real, repetitions), `notes` (text)
    - `entry_writing_data` — `words` (int, required), `time` (int)
    - `entry_custom_data` — `number` (real), `amount` (real), `duration` (int)
  - `app_settings` (`key` PK text, `value` text) — singleton key/value store. Currently holds `currency=EUR` by default (migration 0006).
- **Pagination**: `GET /entries` uses cursor pagination ordered by `(date DESC, id DESC)`. The cursor is `{ date, id }` of the last item in the previous page, base64url-encoded as JSON. Default page size is 20.
- **Migrations**: managed by `drizzle-kit`, output to `backend/drizzle/`. Generate with `npm run db:generate`, apply with `npm run db:migrate`. Also applied automatically on backend startup via `runMigrations()` in `src/db/migrate.ts`.
- **Seeding**: triggered inside `createUser()` — every new user gets the eight example habits via `seedHabitDefinitionsForUser(userId)`. Skipped when `NODE_ENV=test` so backend tests can assert exact habit counts. No startup-time seeding.

## Frontend

- **Build tool**: Vite 5 (port 5173)
- **Plugins**: `@vitejs/plugin-react`, `@tailwindcss/vite`
- **Path alias**: `@/*` → `src/*` (defined in both `tsconfig.json` and `vite.config.ts`)

### Entry & providers

The provider stack is split between `src/main.tsx` (transport-level) and `src/App.tsx` (app-level).

`src/main.tsx` mounts (outer → inner):
1. `React.StrictMode`
2. `QueryClientProvider` — TanStack Query with `staleTime: 30s`, `refetchOnWindowFocus: false`, and a `MutationCache` whose `onError` surfaces failures as `sonner` toasts (global error notifications for every mutation)
3. `BrowserRouter`
4. `<App />`

`src/App.tsx` adds (outer → inner):
1. `UserProvider` — active user state + localStorage persistence
2. `LogEntryDialogProvider` — owns the shared Log/Edit modal opened from the header and the entries list
3. `Header` + `Routes` + `<Toaster richColors position="top-center" />` (sonner mount point)

### Routing

`src/App.tsx` defines three routes:
| Path | Component | Purpose |
|---|---|---|
| `/` | `Home` | Default; demonstrates API connectivity by calling `/health` |
| `/metrics` | `Metrics` | Last-3-months bar chart by archetype + per-habit heatmaps + CSV export |
| `/settings` | `Settings` | User management and habit definitions management (Slices 1–2) |

### Header

`src/components/Header.tsx` is sticky and mobile-friendly. The `UserSwitcher` is rendered on every route (it stays hidden until more than one user exists). Beyond that, it conditionally renders:
- **On `/`**: app title on the left; on the right, the Log entry button (Lucide `PlusCircle`, disabled until there is an active user **and** at least one habit definition), Metrics icon (`BarChart3`), and Settings icon (`Settings`)
- **On any other route**: back arrow that navigates home (Lucide `ArrowLeft`); the route-specific icons are hidden

The Log button opens the shared Log/Edit modal via `useLogEntryDialog()`.

### Styling

- **Tailwind CSS v4** loaded via `@tailwindcss/vite` (no PostCSS config needed)
- `src/index.css` contains:
  - `@import "tailwindcss"`
  - `:root` block with shadcn neutral color tokens (oklch values)
  - `@theme inline` block mapping tokens to Tailwind color utilities
  - `@layer base` for global resets (border, background, full-height layout, font)
- **No `tailwind.config.js`** — v4 reads config from CSS

### UI primitives

`src/components/ui/` contains shadcn components installed via `npx shadcn@latest add`:
- `button.tsx`, `input.tsx`, `select.tsx`, `dialog.tsx`, `dropdown-menu.tsx`, `switch.tsx`, `label.tsx`, `alert-dialog.tsx`
- Use `cn()` from `@/lib/utils` (clsx + tailwind-merge) to compose classes
- Use the `radix-ui` umbrella package for primitives (Slot, Dialog, Select)
- `sonner` provides toast notifications; the `<Toaster>` is mounted once in `App.tsx` and the `QueryClient`'s `MutationCache` pipes mutation errors into it

### API client

`src/lib/api.ts` exports a single `apiFetch<T>(path, options)` function that:
- Prefixes `path` with `import.meta.env.VITE_API_URL`
- Defaults to `Content-Type: application/json`
- Serializes the body with `JSON.stringify` when provided
- Throws on non-2xx responses
- Returns `response.json()` typed as `T`

## Shared types

`shared/src/index.ts` is imported as `@habitsapp/shared` from both backend and frontend. It is the contract for every slice and groups types by feature area:
- **Health**: `HealthResponse`
- **Users**: `User`, `CreateUserBody`, `UpdateUserBody`
- **Habit definitions**: `HabitType` (+ the `HABIT_TYPES` runtime list), `HabitDefinition`, `CreateHabitDefinitionBody`, `UpdateHabitDefinitionBody`
- **Entries**: `Entry`, `EntryData` (the union of `WorkoutData` / `WritingData` / `CustomData`), `EntryCursor`, `EntriesPage`, `CreateEntryBody`, `UpdateEntryBody`
- **Metrics**: `WeeklyMetrics` (+ `WeekDayMetrics`, `HabitCount`), `ByTypeMetrics` (+ `ByTypeWeek`), `HeatmapMetrics` (+ `HabitHeatmap`, `HeatmapDay`)

The package has no build step — both apps consume the `.ts` source directly.

## Communication

- REST + JSON
- Backend allows requests from `CORS_ORIGIN` (default `http://localhost:5173`)
- Frontend targets `VITE_API_URL` (default `http://localhost:3001`)

## Testing

- **Backend**: Vitest + supertest. Setup file at `src/test/setup.ts` runs migrations against an in-memory SQLite (`DATABASE_URL=:memory:` set in `vitest.config.ts`) and truncates `users`, `habit_definitions`, and the entries tables before each test. Tests live in `backend/src/**/__tests__/`. Covers `/health`, Users (CRUD + default-user invariants), Habit Definitions (CRUD, color rotation, positive-flag enforcement, seeding), Entries (CRUD per archetype, cursor pagination, type-lock/delete-block guards), `/metrics/weekly` (Mon–Sun range, per-day aggregation, habit filter, user isolation), `/metrics/by-type` + `/metrics/heatmap` (13/26-week range, archetype/per-habit aggregation, range edge exclusion, user isolation, recent-first ordering), and `/export/csv` (validation, CSV escaping, archetype column mapping, range filter, user isolation).
- **Frontend**: Vitest + jsdom + `@testing-library/react` + `@testing-library/jest-dom`. Setup file at `src/test/setup.ts` registers matchers, per-test cleanup, and a `ResizeObserver` polyfill (Radix UI primitives need it). `src/test/test-utils.tsx` exports a `TestProviders` wrapper (QueryClient + UserProvider + LogEntryDialogProvider) used by component tests; tests that need routing add their own `MemoryRouter`. Tests live in `src/**/__tests__/`. Covers the `Header`, `apiFetch`, `HabitForm`, `EntryForm`, `WeekChartSection`, `ByTypeChartSection` (Nivo `ResponsiveBar` is mocked so tests assert on the chart model — keys, data, colors, and empty state), `HeatmapSection` (asserts the 26×7 grid, totals, and per-habit color choice), and `ExportSection` (URL params, error rendering, blob download trigger).
- **E2E**: Playwright (`@playwright/test`) at the repo root. Config at `playwright.config.ts`. Tests live in `e2e/tests/`. Key characteristics:
  - Uses a **separate SQLite database** (`backend/habits.e2e.db`) so it never touches the dev DB.
  - `e2e/global-setup.ts` deletes the test DB files before the suite runs, ensuring a clean state.
  - `playwright.config.ts` launches both servers via `webServer`: backend on port **4001** (env injected by Playwright: `DATABASE_URL=./habits.e2e.db`, `PORT=4001`, `CORS_ORIGIN=http://localhost:4173`) and frontend on port **4173** (reads `frontend/.env.e2e` for `VITE_API_URL=http://localhost:4001`).
  - `workers: 1` / `fullyParallel: false` — enforced because tests share a single SQLite file.
  - `NODE_ENV` is not set to `test`, so seeding runs as in production.
  - Browser binary not included in the repo; install once with `npm run test:e2e:install`.

## Commands

```bash
npm install                  # install all workspaces
npm run dev                  # both backend and frontend
npm run dev:backend          # backend only (port 3001)
npm run dev:frontend         # frontend only (port 5173)
npm test                     # all workspace tests (Vitest)
npm run build                # production builds
npm run db:generate          # generate Drizzle migrations
npm run db:migrate           # apply pending migrations
npm run test:e2e:install     # download Playwright's Chromium binary (run once)
npm run test:e2e             # run Playwright e2e suite
npm run test:e2e:ui          # open Playwright UI mode
```
