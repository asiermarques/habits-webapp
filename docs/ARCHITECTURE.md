# Architecture

This document decribe the architecture behind of the codebase: structure, conventions, tech tradeoffs, and reference files to copy when adding a slice. For *what* the app does, see [`PRODUCT.md`](./PRODUCT.md). For setup and run commands, see the [`README`](../README.md). For canonical vocabulary, see [`UBIQUITOUS_LANGUAGE.md`](./UBIQUITOUS_LANGUAGE.md).

## Stack

| Concern | Choice | Why |
|---|---|---|
| Backend runtime | Node.js (ESM, `"type": "module"`) | Single language across stack |
| HTTP framework | Express 4 | Minimal, well-known, easy to navigate |
| Database | SQLite via `better-sqlite3` (WAL + `foreign_keys=ON`) | Zero-ops; single-instance app |
| ORM / migrations | Drizzle + `drizzle-kit` | Typed schema, lightweight runtime |
| Frontend | React 18 + Vite 5 | Fast dev loop; ESM end-to-end |
| Styling | Tailwind v4 + shadcn primitives | v4 reads config from CSS (`@theme inline` in `index.css`) — **no `tailwind.config.js`** |
| Data fetching | TanStack Query | Caching + global mutation-error toasts via `MutationCache` |
| Validation | Zod via `validateBody` / `validateQuery` middleware | Single way to validate; never hand-roll `req.body` checks |
| Shared types | `@habitsapp/shared` workspace | TS source consumed directly — no build step |
| Tests | Vitest + supertest (backend), Vitest + RTL (frontend), Playwright (e2e) | Same runner across packages |
| Charts | `@nivo` | Mocked in tests so assertions hit the chart model, not SVG |
| Toasts | `sonner` | Mounted once in `App.tsx`; piped from `MutationCache.onError` |

## Non-obvious tradeoffs

- **Unauthenticated multi-user.** There is no auth layer. `userId` is sent by the client. Every multi-user query filters by `userId`; cross-user access is enforced in the http/domain layer (e.g. entry creation rejects with HTTP 403 if `habitDefinitionId` belongs to a different user).
- **No build step for `shared/`.** Backend and frontend import `.ts` source directly through the workspace symlink, using Node 22's `--experimental-transform-types` at runtime in Docker. Don't add a `dist/`.
- **Entries split by archetype.** Each archetype gets its own child table (`entry_workout_data`, `entry_writing_data`, `entry_custom_data`) joined to `entries`. Each row only carries columns valid for its type, at the cost of one join.
- **Migrations run on startup.** `runMigrations()` is called from `createApp()`, so dev and prod pick up new migrations automatically.
- **Seeding is on user creation, not startup.** `createUser()` calls `seedHabitDefinitionsForUser(userId)`. **Skipped when `NODE_ENV=test`** so backend tests can assert exact counts.
- **`createApp()` factory.** Express setup is separated from the listener (`src/index.ts`) so `supertest` can hit the app without binding a port.

## Repository layout

npm workspaces monorepo: `backend/` (Express API), `frontend/` (React SPA), `shared/` (shared TS types).

```
habitsapp/
├── backend/src/
│   ├── app.ts             createApp() factory (index.ts owns the listener)
│   ├── shared/
│   │   ├── domain/        DomainError subclasses, value objects (IsoDate, Currency)
│   │   ├── db/            Drizzle connection, schema, migrations
│   │   └── middleware/    errorHandler, validateBody / validateQuery
│   ├── users/             command slice
│   ├── habit-definitions/ command slice
│   ├── entries/           command slice
│   ├── settings/          command slice
│   ├── metrics/           read-model slice
│   └── export/            read-model slice
├── frontend/src/
│   ├── pages/             Home, Metrics, Settings
│   ├── components/        Header + shadcn ui/ primitives
│   ├── users/ habits/ entries/ metrics/ export/ settings/
│   └── lib/               apiFetch, currency formatter, i18n, locale, cn()
├── shared/src/index.ts    shared types (no build step)
├── e2e/                   Playwright tests
└── playwright.config.ts
```

## Backend slice patterns

The backend is split into **vertical slices**. Each slice owns its domain, persistence, and HTTP surface.

**Command slices** (`users/`, `habit-definitions/`, `entries/`, `settings/`):

```
<slice>/
├── domain/          Pure types, invariant functions, repository port (interface)
├── infrastructure/  Drizzle adapter implementing the port; owns db.transaction
├── http/            createXxxRouter(repo) factory + Zod schemas
└── __tests__/       Vitest + supertest integration tests
```

**Read-model slices** (`metrics/`, `export/`) — no domain layer:

```
<slice>/
├── queries/     Drizzle/SQL query functions
├── http/        createXxxRouter() factory + Zod schemas
└── __tests__/
```

### Slice rules

- **Domain is pure** — no Drizzle imports; functions are synchronous and throw `DomainError` subclasses
- **Infrastructure owns transactions** — `db.transaction(...)` lives only in Drizzle adapters
- **Repositories return domain values or throw `DomainError`** — no `{ status: 'not_found' }` objects
- **`http/` routes use `validateBody` / `validateQuery`** — never read `req.body` directly
- **Cross-slice dependencies go through injected repository ports**, not direct file imports
- **Router factories take their repo as a parameter** — composition happens in `app.ts`

### DomainError → HTTP mapping

All errors thrown from domain or repository code must extend `DomainError` (`backend/src/shared/domain/errors/DomainError.ts`). `domainErrorHandler` middleware translates them to HTTP responses of the form `{ "error": "<message>" }`. Anything else falls through to Express's default 500 handler.

| Subclass | Status | Use for |
|---|---|---|
| `ValidationError` | 400 | Domain invariants beyond what Zod can express (e.g. forbidden state transitions) |
| `ForbiddenError` | 403 | Cross-user access attempts (e.g. entry references another user's habit) |
| `NotFoundError` | 404 | Repository lookups that miss |
| `ConflictError` | 409 | State conflicts: deleting the last user, changing type after entries exist, deleting a habit with entries |

Zod failures from `validateBody` / `validateQuery` short-circuit with their own 400 response before reaching the domain layer — don't try to mirror Zod errors with `ValidationError`.

### `userId` trust boundary

There is no auth, by design. The client sends `userId` in every multi-user request (query string for GETs, body for POST/PUT). The HTTP layer trusts it verbatim — **every repository method that touches a multi-user table takes `userId` and filters by it**. This is the only thing standing between users; treat it as a load-bearing invariant, not boilerplate to refactor away. Cross-user references (e.g. an entry pointing at another user's habit) are caught in the slice's domain/http layer and rejected with `ForbiddenError`.

### Reference implementations

When adding a new **command slice**, copy `habit-definitions/`:

| Layer | Reference file |
|---|---|
| domain type + invariants | `backend/src/habit-definitions/domain/HabitDefinition.ts` |
| domain errors | `backend/src/habit-definitions/domain/errors.ts` |
| repository port | `backend/src/habit-definitions/domain/HabitDefinitionRepository.ts` |
| Drizzle adapter | `backend/src/habit-definitions/infrastructure/DrizzleHabitDefinitionRepository.ts` |
| router factory | `backend/src/habit-definitions/http/routes.ts` |
| Zod schemas | `backend/src/habit-definitions/http/schemas.ts` |
| integration tests | `backend/src/habit-definitions/__tests__/habit-definitions.test.ts` |

When adding a new **read-model slice**, copy `metrics/`:

| Layer | Reference file |
|---|---|
| query function | `backend/src/metrics/queries/weekly.ts` |
| router factory | `backend/src/metrics/http/routes.ts` |
| Zod schemas | `backend/src/metrics/http/schemas.ts` |

## Domain model

```
User (1) ─< HabitDefinition (1) ─< HabitEntry >─ has one of:
                                                   WorkoutData | WritingData | CustomData
```

### User
Global; `id`, `name`, `isDefault`, `createdAt`. Invariants in `users/domain/User.ts`:
- First user created is automatically default
- Setting one default un-sets the others
- Deleting the default promotes the next-oldest
- The last user cannot be deleted (HTTP 409)

### HabitDefinition
Per-user; `id`, `userId` (FK, cascade), `name`, `type` (`workout` | `writing` | `custom`), `positive`, `color`, `createdAt`. Plus a response-only `hasEntries` computed via `EntryRepository.hasEntriesForDefinition` (drives the UI's type-lock and delete-block affordances). Invariants in `habit-definitions/domain/HabitDefinition.ts`:
- Workout and Writing are forced to `positive: true`
- Color is auto-assigned: negative → red (`#ef4444`); positive → next in a rotating 8-color palette, counted **per user**
- Type cannot change once entries reference the definition (HTTP 409)
- Cannot be deleted while entries exist (HTTP 409)

### HabitEntry
`id`, `habitDefinitionId` (FK, restrict), `userId` (FK, cascade), `date` (`YYYY-MM-DD`), `createdAt`. Cross-user `habitDefinitionId` is rejected with HTTP 403. Archetype data lives in child tables, each with `entry_id` PK FK→cascade:

- `entry_workout_data` — `duration` (int, required), `distance` (real), `weight` (real), `number` (real, repetitions), `notes` (text)
- `entry_writing_data` — `words` (int, required), `time` (int)
- `entry_custom_data` — `number` (real, repetitions), `amount` (real, cost spent), `duration` (int)

`name` and `positive` for Custom live on the parent `HabitDefinition`, not on the entry.

### Adding a new archetype

The three archetypes (`workout`, `writing`, `custom`) are spread across many files. To add a fourth, touch all of these in one slice — order matters because TypeScript will catch missed updates once the shared types change:

1. **Shared types** — extend the `HabitType` union and the entry data discriminated union in `shared/src/index.ts`.
2. **DB schema** — add a new `entry_<archetype>_data` table in `backend/src/shared/db/schema.ts` (PK FK→`entries.id` cascade), then `npm run db:generate` and review the SQL.
3. **Domain** — update the `HabitDefinition` invariants in `habit-definitions/domain/HabitDefinition.ts` if the new archetype has rules like Workout/Writing being forced `positive: true`.
4. **Entries http** — extend the discriminated `data` schema in `entries/http/schemas.ts` and the create/update branching in `entries/http/routes.ts`.
5. **Entries infrastructure** — add the insert/update/delete branch in the Drizzle adapter so the child row is written inside the same `db.transaction(...)`.
6. **Metrics** — apply the repetition-counting rule (sum `number` when set, otherwise count as 1, unless the archetype is count-as-1 like Writing) in `metrics/queries/*`.
7. **CSV export** — add any new columns to the header and row mapping in `export/queries` and `export/http/routes.ts`. Unused columns stay blank for other archetypes.
8. **Seed** — extend `backend/src/habit-definitions/seed.ts` if the archetype should ship as a default habit.
9. **Frontend** — add a form variant in `frontend/src/entries/EntryForm.tsx`, render in `EntriesList`, and update `HabitForm` so users can pick the new type.
10. **Tests** — integration test under `backend/src/entries/__tests__/` covering create + list + cross-user 403; frontend RTL test for the form variant.

### AppSettings
Singleton key/value table — currently `currency` (default `EUR`) and `locale` (default `en`).

## HTTP surface

| Endpoint | Notes |
|---|---|
| `GET /health` | `{ ok: true }` |
| `GET/POST /users`, `PUT/DELETE /users/:id` | CRUD |
| `GET /habit-definitions?userId=`, `POST /habit-definitions` (body requires `userId`), `PUT/DELETE /habit-definitions/:id` | per-user list |
| `GET /entries?userId=&habitDefinitionId=&cursor=&limit=`, `POST /entries`, `PUT/DELETE /entries/:id` | cursor pagination ordered by `(date DESC, id DESC)`; cursor is base64url JSON `{date, id}`; default page size 15, max 100 |
| `GET /metrics/weekly?userId=&habitDefinitionId=&today=` | current week (Mon–Sun), per-day sparse `counts` per habit; `today` (YYYY-MM-DD) is optional and used by tests |
| `GET /metrics/by-type?userId=&today=` | 13-week range (Mon–Sun) ending at the anchor week; per-archetype repetitions; always 13 ordered weeks, zero-filled |
| `GET /metrics/by-habit?userId=&today=` | same 13-week range; per-habit instead of per-archetype; sparse |
| `GET /metrics/summary?userId=&today=` | last-30-day rollup: `mostRegistered`, `leastRegistered` (zero-entry habits can win), `badHabitsTotalCost` (sum of `entry_custom_data.amount` where the definition is `positive=false`), `activeHabitsCount` |
| `GET /metrics/heatmap?userId=&today=` | rolling 26 weeks per habit; sparse `{date, count}[]`; habits ordered by most-recent in-range entry, empty habits last |
| `GET /export/csv?userId=&from=&to=` | `text/csv; charset=utf-8`, attachment. Columns: `date, habit_name, type, positive, duration, distance, weight, amount, notes, words, time, number`. RFC-4180 escaped; unused archetype columns are blank |
| `GET /settings`, `PUT /settings/currency`, `PUT /settings/locale` | global singleton; currency validated against `SUPPORTED_CURRENCIES`, locale against `SUPPORTED_LOCALES` (`en`, `es`) |

**Repetition-counting rule** shared across all metrics endpoints: for Workout and Custom entries, sum the `number` field when set, otherwise count the entry as 1. Writing entries always count as 1.

## Backend runtime

- **Config**: `dotenv` loads `backend/.env`. Variables: `PORT` (default 3001), `DATABASE_URL` (default `./habits.db`), `CORS_ORIGIN` (default `http://localhost:5173`), `FRONTEND_DIST_DIR` (production only)
- **Production static serving**: when `NODE_ENV=production`, `createApp()` registers `express.static(FRONTEND_DIST_DIR)` *after* the API routes and a catch-all `GET *` that serves `index.html` for React Router deep links. In other environments unknown routes return 404
- **Dev runner**: `tsx watch src/index.ts`

## Database layer

- Connection (`src/shared/db/index.ts`): opens `DATABASE_URL`, applies `journal_mode = WAL` and `foreign_keys = ON`
- Schema (`src/shared/db/schema.ts`): `users`, `habit_definitions`, `entries`, the three archetype child tables, and `app_settings`
- Migrations live in `backend/drizzle/`. Generate with `npm run db:generate`, apply with `npm run db:migrate`. Also applied on startup via `runMigrations()` in `src/shared/db/migrate.ts`
- Seeding is **not** at startup — it's triggered in `createUser()` and skipped when `NODE_ENV=test`

## Frontend

- Build: Vite 5 (port 5173); plugins `@vitejs/plugin-react`, `@tailwindcss/vite`
- Path alias `@/*` → `src/*` (defined in both `tsconfig.json` and `vite.config.ts`)

### Provider stack

Transport-level in `src/main.tsx` (outer → inner):
1. `React.StrictMode`
2. `QueryClientProvider` — TanStack Query with `staleTime: 30s`, `refetchOnWindowFocus: false`, and a `MutationCache` whose `onError` surfaces toasts via `sonner` (every mutation error becomes a toast for free)
3. `BrowserRouter`
4. `<App />`

App-level in `src/App.tsx` (outer → inner):
1. `UserProvider` — active user state + `localStorage` persistence
2. `LogEntryDialogProvider` — owns the shared Log/Edit modal opened from the header and the entries list
3. `LocaleProvider` — calls `setActiveLocale()` and re-keys its subtree so static `t(...)` calls re-evaluate on locale change
4. `Header` + `Routes` + `<Toaster richColors position="top-center" />`

### Routing

| Path | Component |
|---|---|
| `/` | `Home` |
| `/metrics` | `Metrics` |
| `/settings` | `Settings` |

### UI primitives

- shadcn components under `src/components/ui/`: `button`, `input`, `select`, `dialog`, `dropdown-menu`, `switch`, `label`, `alert-dialog`
- `date-picker.tsx` is **in-house** (not a shadcn install) — built to avoid pulling Popover/Calendar deps. Used in the entry form and the CSV export
- Compose classes with `cn()` from `@/lib/utils` (clsx + tailwind-merge)
- Use the `radix-ui` umbrella package for primitives (Slot, Dialog, Select)

### Styling

- Tailwind v4 via `@tailwindcss/vite` — **no PostCSS, no `tailwind.config.js`**
- `src/index.css` contains:
  - `@import "tailwindcss"`
  - `:root` with shadcn neutral tokens (oklch)
  - `@theme inline` mapping tokens to Tailwind utilities
  - `@layer base` resets (border, background, full-height layout, font)

### i18n and locale

- `settings.locale` (`en` | `es`) is the source of truth, applied by `LocaleProvider`
- UI strings: `t(key)` against a flat-key dictionary in `src/lib/i18n.ts`
- Date/number formatting: `getLocale()` in `src/lib/locale.ts` maps `en` → `en-US`, `es` → `es-ES`
- **Never** call `Intl.DateTimeFormat(undefined, …)` or `Date#toLocaleDateString(undefined, …)` — always pass `getLocale()`
- `VITE_LOCALE` works as a build-time override for tests

### API client

`src/lib/api.ts` exports `apiFetch<T>(path, options)` which prefixes `VITE_API_URL`, defaults `Content-Type: application/json`, serializes the body, throws on non-2xx, and returns `response.json()` typed as `T`.

### Data fetching conventions

Each frontend feature folder (`entries/`, `habits/`, `users/`, `metrics/`) owns a `queries.ts` that exports its TanStack Query hooks and a `<feature>Key(...)` builder. Conventions:

- **Query keys** are tuples starting with the feature name, e.g. `['entries', userId, habitDefinitionId ?? 'all']`. Always include `userId` so switching active user invalidates cleanly.
- **`enabled: userId > 0`** on any query that depends on the active user — `UserProvider` returns `0` before a user is selected.
- **Mutation hooks invalidate by feature prefix**, not by exact key: `qc.invalidateQueries({ queryKey: ['entries'] })`. Anything that changes entries also invalidates `['metrics']` since metrics are derived. Follow the same pattern when adding new derived read models.
- **No manual error toasts** — `MutationCache.onError` in `main.tsx` already surfaces every mutation error. Only catch in components for inline UI state.
- **Cursor pagination** uses `useInfiniteQuery` with `getNextPageParam: (lastPage) => lastPage.nextCursor`; see `useEntriesInfinite` for the canonical example.

### Active user

`UserProvider` (`frontend/src/users/UserContext.tsx`) owns the active `userId` and persists it to `localStorage`. Components read it via the `useUserContext()` hook. Before the first user exists or is selected, the active id is `0` — feature queries gate on `userId > 0` rather than rendering empty states from a request that 400s.

## Shared types

`shared/src/index.ts` is imported as `@habitsapp/shared` from both packages. It is the contract for every slice and groups types by feature area (Health, Users, HabitDefinitions, Entries, Metrics). No build step — both apps consume `.ts` source directly.

## Communication

- REST + JSON
- Backend allows requests from `CORS_ORIGIN` (default `http://localhost:5173`)
- Frontend targets `VITE_API_URL` (default `http://localhost:3001`)

## Testing

- **Backend**: Vitest + supertest. `src/test-setup.ts` runs migrations against in-memory SQLite (`DATABASE_URL=:memory:` set in `vitest.config.ts`) and truncates `users`, `habit_definitions`, and the entries tables before each test. Tests live in `backend/src/**/__tests__/`
- **Frontend**: Vitest + jsdom + `@testing-library/react`. Setup at `src/test/setup.ts` registers matchers, per-test cleanup, and a `ResizeObserver` polyfill (needed by Radix). `src/test/test-utils.tsx` exports a `TestProviders` wrapper (QueryClient + UserProvider + LogEntryDialogProvider); tests that need routing add their own `MemoryRouter`. Nivo `ResponsiveBar` is mocked so chart tests assert keys/data/colors instead of SVG output
- **E2E**: Playwright at the repo root (`playwright.config.ts`, tests in `e2e/tests/`):
  - Separate DB (`backend/habits.e2e.db`); `e2e/global-setup.ts` deletes it before each suite run
  - Backend on port **4001** (`DATABASE_URL=./habits.e2e.db`, `CORS_ORIGIN=http://localhost:4173`), frontend on **4173** (reads `frontend/.env.e2e` for `VITE_API_URL=http://localhost:4001`)
  - `workers: 1` / `fullyParallel: false` — enforced because tests share one SQLite file
  - `NODE_ENV` is **not** `test`, so seeding runs as in production
  - Install Chromium once with `npm run test:e2e:install`

## Deployment

The repo ships a multi-stage `Dockerfile` that produces a single production image (~266 MB). The frontend is compiled with `VITE_API_URL=""` so API calls are same-origin, and Express serves the static assets when `NODE_ENV=production`. SQLite persistence is a named Docker volume declared in `docker-compose.yml`.

The shared package is **not** built — its TypeScript is loaded at runtime via the workspace symlink using Node 22's `--experimental-transform-types`.

## CI

CircleCI (`.circleci/config.yml`) runs two sequential jobs on every push.

## Commands

The canonical run/setup commands live in [`README.md`](../README.md). Drizzle-specific:

```bash
npm run db:generate    # generate migrations from schema changes
npm run db:migrate     # apply pending migrations
```
