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
│   ├── export/            read-model slice
│   ├── sync/              read-model slice — data-version token
│   └── backup/            JSON export (read) + import orchestration over injected ports
├── frontend/src/
│   ├── pages/             Home, Metrics, Settings
│   ├── components/        Header + shadcn ui/ primitives
│   ├── users/ habits/ entries/ metrics/ export/ backup/ settings/ sync/
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

**Read-model slices** (`metrics/`, `export/`, `sync/`) — no domain layer:

```
<slice>/
├── queries/     Drizzle/SQL query functions
├── http/        createXxxRouter() factory + Zod schemas
└── __tests__/
```

**`backup/`** is a hybrid: export is a read-model `queries/buildBackup.ts`, but import is a *write* that spans two slices. Rather than touch their tables, `importBackup.ts` orchestrates the injected `HabitDefinitionRepository` and `EntryRepository` ports (so per-type validation, ownership, and FK mapping are reused), and `createBackupRouter(habitRepo, entryRepo)` is wired in `app.ts`. The bundle is fully validated in `http/schemas.ts` before any write, so a bad row never half-applies; merge-skip then makes re-import idempotent. Import is intentionally non-atomic (one transaction per repo call).

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
- Color is user-selectable from a curated 8-color set (`CURATED_COLORS` in `habit-definitions/domain/Color.ts`, also exported as `HABIT_CURATED_COLORS` from `shared`). Red (`HABIT_NEGATIVE_COLOR = #ef4444`) is excluded for Positive Habits; it is the default for Negative Habits. If no color is provided, the server auto-assigns (rotating palette for Positive, red for Negative). `validateColor` enforces set membership and the red-reservation rule; it is called in the Drizzle adapter for the create and update paths. Backup import bypasses this check intentionally.
- Color is always editable — unlike type, it is not locked once entries exist
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
8. **Backup** — `backup/queries/buildBackup.ts` reconstructs the new archetype's `data` from its child table, and `backup/http/schemas.ts` validates the new per-type invariants on import (it mirrors `entries/domain` rather than importing it).
9. **Seed** — extend `backend/src/habit-definitions/seed.ts` if the archetype should ship as a default habit.
10. **Frontend** — add a form variant in `frontend/src/entries/EntryForm.tsx`, render in `EntriesList`, and update `HabitForm` so users can pick the new type.
10. **Tests** — integration test under `backend/src/entries/__tests__/` covering create + list + cross-user 403; frontend RTL test for the form variant.

### AppSettings
Singleton key/value table — currently `currency` (default `EUR`) and `locale` (default `en`).

## HTTP surface

All data-bearing endpoints are mounted under an **`/api`** prefix (an `express.Router()` group in `app.ts`). This keeps them from colliding with the SPA's client-side routes (`/`, `/metrics`, `/settings`) — without it, a hard-reload/deep-link to `/settings` would hit the API and return JSON instead of the app shell. `GET /health` deliberately stays at the **root** (un-prefixed) so platform healthchecks have a stable path; it is also the carve-out from the instance gate (the gate guards `/api/*`, leaving `/health` and the static SPA open).

| Endpoint | Notes |
|---|---|
| `GET /health` | `{ ok: true }` — **root, not under `/api`** |
| `GET /api/auth/status`, `POST /api/auth/login`, `POST /api/auth/logout` | instance password gate (see "Instance password gate"). **Open** — mounted before the gate middleware. `status` returns `{ gated, authenticated }`; `login` takes `{ password }` and sets a signed session cookie |
| `GET/POST /api/users`, `PUT/DELETE /api/users/:id` | CRUD |
| `GET /api/habit-definitions?userId=`, `POST /api/habit-definitions` (body requires `userId`), `PUT/DELETE /api/habit-definitions/:id` | per-user list |
| `GET /api/entries?userId=&habitDefinitionId=&cursor=&limit=`, `POST /api/entries`, `PUT/DELETE /api/entries/:id` | cursor pagination ordered by `(date DESC, id DESC)`; cursor is base64url JSON `{date, id}`; default page size 15, max 100 |
| `GET /api/metrics/weekly?userId=&habitDefinitionId=&today=` | current week (Mon–Sun), per-day sparse `counts` per habit; `today` (YYYY-MM-DD) is optional and used by tests |
| `GET /api/metrics/by-type?userId=&today=` | 13-week range (Mon–Sun) ending at the anchor week; per-archetype repetitions; always 13 ordered weeks, zero-filled |
| `GET /api/metrics/by-habit?userId=&today=` | same 13-week range; per-habit instead of per-archetype; sparse |
| `GET /api/metrics/summary?userId=&today=` | last-30-day rollup: `mostRegistered`, `leastRegistered` (zero-entry habits can win), `badHabitsTotalCost` (sum of `entry_custom_data.amount` where the definition is `positive=false`), `activeHabitsCount` |
| `GET /api/metrics/heatmap?userId=&today=` | rolling 26 weeks per habit; sparse `{date, count}[]`; habits ordered by most-recent in-range entry, empty habits last |
| `GET /api/export/csv?userId=&from=&to=` | `text/csv; charset=utf-8`, attachment. Columns: `date, habit_name, type, positive, duration, distance, weight, amount, notes, words, time, number`. RFC-4180 escaped; unused archetype columns are blank |
| `GET /api/backup?userId=` | `application/json`, attachment. Full round-trippable bundle `{ version, exportedAt, habitDefinitions[], entries[] }` for one user; entries reference their definition by `habitName` |
| `POST /api/backup/import` | body `{ userId, version, habitDefinitions[], entries[] }` → `ImportResult { habitsCreated, habitsSkipped, entriesCreated, entriesSkipped }`. Merge-skip (definition by name, entry by habit+date); whole bundle is Zod-validated up-front, then applied via the habit-definition + entry repository ports |
| `GET /api/sync/version?userId=` | `{ version }` — opaque change token for one User's view of the instance (their data plus the instance-wide bits). Two indexed lookups, no scan. Clients compare for equality only; the format is not part of the contract |
| `GET /api/settings`, `PUT /api/settings/currency`, `PUT /api/settings/locale` | global singleton; currency validated against `SUPPORTED_CURRENCIES`, locale against `SUPPORTED_LOCALES` (`en`, `es`) |

The frontend never hardcodes the prefix per call: `apiFetch` prepends `/api` once (`frontend/src/lib/api.ts`), and feature hooks pass bare paths like `/entries`.

**Repetition-counting rule** shared across all metrics endpoints: for Workout and Custom entries, sum the `number` field when set, otherwise count the entry as 1. Writing entries always count as 1.

## Backend runtime

- **Config**: `dotenv` loads `backend/.env`. Variables: `PORT` (default 3001), `DATABASE_URL` (default `./habits.db`), `CORS_ORIGIN` (default `http://localhost:5173`), `FRONTEND_DIST_DIR` (production only), `GATE_PASSWORD` + `SESSION_SECRET` (instance gate, see below), and the standard `OTEL_*` vars (telemetry, see below)
- **Production static serving**: when `NODE_ENV=production`, `createApp()` registers `express.static(FRONTEND_DIST_DIR)` *after* the API routes and a catch-all `GET *` that serves `index.html` for React Router deep links. In other environments unknown routes return 404

### Instance password gate

An optional, instance-wide barrier for public deployments — **not** per-user auth. It lives in `backend/src/shared/auth/gate.ts` (a cross-cutting concern, not a slice: no domain/infrastructure layer, no DB table). `app.ts` reads the config once via `readGateConfig()`, mounts the open `/api/auth` router, then `createGateMiddleware()` on the rest of `/api`.

- **Fail-open**: when `GATE_PASSWORD` is unset the gate is disabled and every endpoint behaves as before. This keeps local dev and tests config-free (no gate env vars in `test-setup`).
- **Session**: on a correct password the server issues a signed, HTTP-only cookie (`habits_gate`) — `base64url(payload).HMAC-SHA256(payload, SESSION_SECRET)` with a ~24h expiry, `Secure` in production. The middleware verifies the signature (timing-safe) and expiry on every `/api` request; the password itself is compared via fixed-length SHA-256 digests so there's no length leak.
- **Startup guard**: `assertGateConfig()` throws if `GATE_PASSWORD` is set without `SESSION_SECRET`, so a gated instance can never boot with unsigned (forgeable) sessions.
- **Frontend**: `GateGuard` (`frontend/src/gate/`) reads `GET /api/auth/status` above the feature providers and shows the unlock screen when `gated && !authenticated`. A `401` from any call re-checks status (handled centrally in `main.tsx`), so an expired session bounces the user back to the unlock screen instead of a toast.
- **Dev runner**: `tsx watch src/index.ts`

### Telemetry / observability

An optional OpenTelemetry layer that exports backend traces/metrics/logs to a managed external backend over OTLP — a cross-cutting concern in `backend/src/shared/observability/` (no domain/infrastructure layer, no DB table), like the instance gate. Full operator guide: [`OBSERVABILITY.md`](./OBSERVABILITY.md).

- **Fail-open**: telemetry starts only when an OTLP endpoint (`OTEL_EXPORTER_OTLP_ENDPOINT` / `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`) is configured, and is always inert under `NODE_ENV=test`. Unconfigured ⇒ no SDK, no overhead, behaviour identical to today. `readTelemetryConfig()` decides on/off; `startTelemetry()` boots the SDK once.
- **Startup ordering**: `src/index.ts` imports `shared/observability/instrument.ts` *before* `app.ts`, so the SDK initialises ahead of any instrumentable module (express, `http`, better-sqlite3). The `createApp()`/`index.ts` split is preserved — `supertest` still builds the app without a port.
- **Naming**: called *telemetry/observability* throughout; "Metrics" stays reserved for the habit Metrics product domain. Observability counters are *telemetry metrics*.
- **Privacy**: no Entry Data, Cost Spent, habit names, or User names are ever exported — only operational attributes (route, status, duration, error class).
- **Status**: the SDK bootstrap + fail-open config is implemented (the SDK connects but emits nothing on its own). Trace export with payload suppression, telemetry metrics, and correlated logs are planned on top of it.

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
2. `QueryClientProvider` — TanStack Query with `refetchOnWindowFocus: true`, a retry predicate that gives up immediately on `OfflineError` and 4xx, and a `MutationCache` whose `onError` surfaces toasts via `sonner` (every mutation error becomes a toast for free)
3. `BrowserRouter`
4. `<App />`

### How reads stay fresh without polling

Three mechanisms, in order of who handles what:

1. **Local writes** invalidate their own query keys in `onSuccess`. Instant, no network guesswork.
2. **Remote writes** (another device) are caught by `DataVersionSync` — see below.
3. **`staleTime: 30 min` + `refetchOnWindowFocus`** is only a *backstop*, bounding how long the app could sit on old data if (2) were failing silently.

The default in `main.tsx` is deliberately long and uniform: no `queries.ts` overrides it except the gate (`Infinity` — it changes only via login/logout or a 401, each of which invalidates the key explicitly, and it is the one resource with no cross-device path). Per-resource staleness tuning would just be guessing at how often data changes; the token *knows*.

**`DataVersionSync`** (`frontend/src/sync/`, mounted once in `App.tsx`) is the mirror image of `EntrySync`: that one pushes local changes out, this one pulls remote ones in. It calls `GET /api/sync/version?userId=` and, only when the token differs from the last one it saw, invalidates `users`, `settings`, `habit-definitions`, `entries` and `metrics`. It runs on mount, on `visibilitychange` to visible, on `online`, and on a 60s interval **while the document is visible** — a backgrounded tab polls nothing, and the foreground transition covers the catch-up. That transition is the load-bearing one on mobile: returning to an installed PWA remounts nothing and reconnects nothing, so without it a phone would sit on stale data until a reload it rarely gets.

Two deliberate details: the first check for a user only records a baseline (invalidating there would refetch data the app has just loaded, on every cold start), and it uses `apiFetch` directly rather than a `useQuery` — like `drainPendingEntries`, it is a background signal that is never rendered and whose failures must stay silent, where a `useQuery` would route every offline foreground through the global `QueryCache.onError` toast.

**The token** (`backend/src/shared/db/dataVersion.ts`, table `data_versions`) is a counter per scope — `global` for the User list and instance settings, `user:<id>` for that User's Habit Definitions and Entries — bumped **inside the same transaction as the write it describes**, which is what the "infrastructure owns transactions" rule buys: a bump outside the transaction could be observed without its change, or survive a rollback and advertise one that never happened. A counter rather than a timestamp because it moves for updates and deletes too, which a `max(created_at)` over the data tables would miss entirely. Paths that apply nothing don't bump: an idempotency-key replay, a no-op `PUT`. The per-user scope is why one person logging on a shared instance doesn't make everyone else's devices refetch.

Reading it is two indexed primary-key lookups, so a check that answers "nothing changed" — the overwhelmingly common case — costs a fraction of the entries + metrics refetch it replaces.

Metrics reads are additionally keyed by — and send — `today`, the user's **local** calendar day (`entries/date.ts`'s `todayIso`). Entries are logged against the local day, so metrics must be windowed the same way or a late-evening Entry falls outside "this week" for users whose offset differs from the server's. Keying by it also means a session left open across midnight rolls to the new day's window instead of serving the previous one indefinitely.

App-level in `src/App.tsx` (outer → inner):
1. `UserProvider` — active user state + `localStorage` persistence
2. `LogEntryDialogProvider` — owns the shared Log/Edit modal opened from the header and the entries list
3. `LocaleProvider` — calls `setActiveLocale()` and re-keys its subtree so static `t(...)` calls re-evaluate on locale change
4. `EntrySync` + `DataVersionSync` — headless, render nothing; the outbound and inbound halves of staying in sync (see "How reads stay fresh without polling")
5. `Header` + `Routes` + `<Toaster richColors position="top-center" />`

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

### PWA / service worker

The app is an installable PWA with read-only offline support, configured through `vite-plugin-pwa` (`generateSW`, Workbox under the hood) in `frontend/vite.config.ts`. No separate `sw.js` is hand-written — the worker is generated at `vite build`. It is built **only in production builds**; `vite dev` has no worker, and the plugin is `disable`d entirely under `--mode e2e`, so the Playwright harness never registers it.

- **Registration / updates** — `registerType: 'prompt'`; `injectRegister: false`. `PwaUpdatePrompt` (`frontend/src/pwa/PwaUpdatePrompt.tsx`) calls `useRegisterSW` from `virtual:pwa-register/react`, which registers the worker and exposes `needRefresh`. When a new build is waiting it shows a persistent Sonner toast whose action calls `updateServiceWorker(true)` to skip-waiting and reload — so installed users never pin to a stale worker.
- **App shell** — `globPatterns` precache the built JS/CSS/HTML/icons; `navigateFallback: 'index.html'` serves the SPA offline for `/`, `/metrics`, `/settings` (with `/api/` denied). Google Fonts are runtime-cached (`CacheFirst`/`StaleWhileRevalidate`) so type stays legible offline.
- **Runtime API cache** — `GET /api/*` responses are cached `NetworkFirst` in the `habits-api-cache` (keyed by full URL, only 200s, `maxAgeSeconds` 1 day). Online always prefers fresh data; offline falls back to the last-fetched response. Non-GET methods are never cached. One normalisation: a `cacheKeyWillBeUsed` plugin strips the `today` param from the **cache key** (the network request still carries it). Without it, the first launch of a new day would request a URL that was never cached and the offline fallback would find nothing where yesterday's copy sits. The plugin is serialised into `sw.js` by `workbox-build`, so it must stay self-contained — no closing over anything in `vite.config.ts`.
- **Gate × cache policy (RISK-G1)** — `/api/auth/*` is **deliberately excluded** from the runtime cache, so an expired gate can never be satisfied from cache. The last gate status confirmed online — `{ gated, authenticated, at }` — is persisted by the gate module (`frontend/src/gate/storage.ts`); when the gate status can't be fetched (typically offline), `GateGuard` opens a gated instance **only within a 2-hour grace window** (`OFFLINE_GRACE_MS`) of the last online unlock, and **fails closed** past that window (or when last known locked) by showing the unlock screen rather than serving cached data. Known-open instances pass through so the offline shell still works. On logout, `clearApiCache()` (`frontend/src/pwa/cache.ts`) evicts the whole API cache. **Residual limitation:** because there is no server to consult offline, a gate session that expires purely by server-side timeout cannot be enforced while offline — the privacy guarantee holds for explicit lock/logout and for online expiry (401 → locked), and offline access is bounded to the 2-hour grace window, but an unattended device unlocked within that window can still read cached data offline.
  - **Pending offline Entry changes are hidden but retained across a re-lock, not evicted (`001-offline-entry-logging.md` OQ-002).** `GateGuard` renders either `<GateScreen>` or `{children}` — never both — so when it shows the lock screen, everything mounted under it (`EntrySync`, `Header`, every page) unmounts too: the drain stops, the pending-count indicator disappears, and nothing reads the local pending store. `clearApiCache()` only evicts the Service Worker's `GET` response cache; it never touches the `localStorage`-backed pending-Entry store (`frontend/src/entries/offlineStore.ts`), so a logout, a 401, or an expired grace window all leave pending changes on the device, invisible until the next successful unlock remounts the app and the drain resumes. This is a materially larger residual privacy claim than the read-cache limitation above: unsynced **Entry Data**, including **Cost Spent**, can now sit at rest on a locked device indefinitely, not just within the bounded grace window. It's a deliberate trade (`001-offline-entry-logging.md` BR-005: no local change is dropped without either reaching the backend or being explicitly discarded by the user) — losing data the user believed was saved was judged worse than this exposure. The only way to clear it is the explicit "Discard pending changes" action in Settings (see below), which the user must trigger themselves.
- **Offline mutations** — scoped to **Entries** only; **Habit Definitions**, **Users** and **Settings** stay online-only. `apiFetch` (`frontend/src/lib/api.ts`) wraps `fetch` and, when the request never reaches the server (a network-level `TypeError`), throws a distinct `OfflineError` rather than a generic failure. The global `MutationCache.onError`/`QueryCache.onError` handler in `frontend/src/main.tsx` maps it to a clear "you're offline" Sonner toast for every mutation still covered by that non-goal. Those mutations carry no optimistic updates (they only invalidate `onSuccess`), so a failed offline write never appears saved.
  - **Entry writes** (`frontend/src/entries/offlineStore.ts`, `queries.ts`, `sync.ts`, `EntrySync.tsx`) are the one exception, and offline create/edit/delete all go through it. `useCreateEntry` catches `OfflineError` and, instead of failing, writes the create to a durable `localStorage`-backed store (`offlineStore.ts`) keyed by a client-only negative `localId` that is never sent to the server. `useUpdateEntry`/`useDeleteEntry` branch on the id's sign: a negative id (a create that hasn't synced yet) is amended or removed in the store in place — there's nothing to `PUT`/`DELETE` against — while a positive id queues an update or delete **op** keyed by that server id. Ops collapse by design: the store holds at most one op per Entry id, so a second edit replaces the first (net update) and a delete replaces any queued update (net delete) — this is what satisfies the "local changes collapse before push" requirement without any separate reconciliation step. The store write is synchronous; if it throws (e.g. quota exceeded) the mutation fails for real rather than silently dropping the change (BR-001). Pending creates and ops are **overlaid at read time** onto `useEntriesInfinite` (`EntriesList` — suppressing deleted Entries and substituting updated values) and `useWeeklyMetrics` (`WeekChartSection`, via `metrics/pendingOverlay.ts` — creates and deletes only; queued edits aren't reflected on the chart) rather than injected into TanStack Query's cache — cursor pagination on `(date DESC, id DESC)` would otherwise break. `EntrySync` (mounted once in `App.tsx`) drains the store sequentially — creates via `POST /api/entries`, then ops via `PUT`/`DELETE /api/entries/:id` — on mount, on the browser's `online` event, and every 30s while online, using `apiFetch` directly (not a mutation) so a failing background drain never spams the global error toast; a Header pill (`usePendingChangesCount`) shows the total pending count (creates plus ops), absent at zero.
  - **Sync resilience** (`syncStatus.ts`, `sync.ts`'s `handleDrainError`) — a drain attempt's outcome per item is decided by what `apiFetch` threw: `OfflineError` stops the whole drain without affecting the failure streak (offline is expected, not a failure — the indicator stays neutral "pending"); a 401 mid-drain invalidates the gate-status query key instead (routes into the existing `main.tsx`/`GateGuard` re-lock path) rather than being treated as a rejection; any other 4xx is treated as an unfixable rejection — the item is discarded and a Sonner toast names it and the server's reason (`t('sync.rejected', ...)`), so one poisoned item never blocks the rest of the backlog (two carve-outs from that blanket 4xx-discard are described below); anything else (5xx, unexpected) is a transient failure and counts toward a module-level `failureStreak` in `syncStatus.ts`. A run that completes without stopping resets the streak to 0 on any outcome that isn't a transient failure (success, nothing to do, or an item discarded) — `isSyncFailing()` only flips true once the streak reaches a threshold of 3 consecutive failing *runs*, so a single blip never surfaces as a problem. The Header's failing pill (`useIsSyncFailing`, `entries/queries.ts`) additionally requires `navigator.onLine` — going offline always shows the neutral state regardless of the streak — and offers a manual retry that just calls `drainPendingEntries` again.
  - **Discard pending changes** (`offlineStore.ts`'s `discardAllPending`, `entries/DiscardPendingSection.tsx`) — the one sanctioned exception to BR-005 ("no local change is dropped without either reaching the backend or being explicitly discarded by the user"): an explicit, confirmed, all-or-nothing action in Settings under "Your data" that clears every pending create and op across every User on the device in one shot. Rendered only while `usePendingChangesCount() > 0`.
  - **Exactly-once push (`002-entry-sync-protocol.md`, closes GRISK-001)** — every Pending change carries an opaque Idempotency Key, generated once with `crypto.randomUUID()` at queue time in `offlineStore.ts` (`addPendingEntryCreate`/`addPendingEntryUpdate`/`addPendingEntryDelete`) and persisted with the change, so it stays stable across retries and survives a reload. It identifies the *change*, never the Entry (BR-003) — it's never derived from Entry Data, Cost Spent, or any name, and authenticates nothing (BR-007; that's `003`'s problem). `sync.ts` sends it on every create/update/delete push (body field on create/update, JSON body on the otherwise-bodyless `DELETE`). The backend records applied keys in `applied_idempotency_keys` (`key` — the primary key, no FK to `entries` since the record must outlive a deleted Entry — `entryId`, `responseBody`, `createdAt`) and, inside the same `db.transaction(...)` as the write it guards (`entries/infrastructure/DrizzleEntryRepository.ts`), checks for a recorded key *before* doing anything else: a hit replays the original outcome verbatim without re-applying, even if the retried payload differs; a miss applies the change and records it before the transaction commits, so a crash between the two can't happen. A unique-index collision on the insert (EDGE-002, two drains racing) is mapped rather than left to escape as a raw driver error, though within this single-process, synchronous-SQLite app a true interleaving is only a defensive concern, not a reachable one. The key is optional everywhere (`InsertInput`/`UpdateInput`/`deleteEntrySchema`) so a pre-upgrade client's keyless backlog still drains as before (at-least-once, same as today). **Retention (US-002, resolves OQ-001)**: `entries/infrastructure/idempotencyKeyRetention.ts` deletes recorded keys older than `IDEMPOTENCY_KEY_RETENTION_MS` (30 days — deliberately longer than a Pending change could plausibly stay queued on a device, e.g. a phone offline for a long trip; storage is cheap compared to silently reinstating GRISK-001 with no error, RISK-002). `startIdempotencyKeyCleanup()` runs it on an unref'd `setInterval` (every 6h) from `index.ts`, inert under `NODE_ENV=test` and wrapped in try/catch so a failed run logs and retries next tick instead of silently stopping — the same fail-quiet discipline as telemetry and the instance gate.
  - **Vanished target resolution (`002-entry-sync-protocol.md`, Slice 2)** — the backend keeps its HTTP semantics honest (`DELETE`/`PUT /entries/:id` still 404 via `EntryNotFoundError` when the target is gone); the "already gone is fine" judgement is entirely a client-side decision in `sync.ts`'s `handleDrainError`/`attemptVanishedUpdateRecreate`, the single seam both cases share rather than parallel branches per call site. **A queued delete (US-003)**: a 404 on a delete op is passed `silentNotFound: true` and settles as a plain `'continue'` — discarded, no toast, no failure-streak effect — since the user's intent (the Entry gone) is already satisfied; any other status on a delete still falls through to the ordinary discard-with-toast Rejected-change path. **A queued update (US-004)**: a 404 on an update op routes to `attemptVanishedUpdateRecreate`, which re-creates the Entry via `POST /entries` from the values the op carries — `habitDefinitionId` and `type` were added to the update op's shape in `offlineStore.ts` for exactly this (a pre-upgrade op predating them can't be re-created and falls back to the Rejected-change path instead of crashing the drain) — reusing the *update's own* Idempotency Key so a lost re-creation response and a retry can't produce a second Entry (EDGE-003; the backend's replay check handles it, same mechanism as US-001). On success it shows a Sonner toast naming the Habit Definition (looked up from the `habitDefinitionsKey` TanStack Query cache) and the Date (`t('sync.recreated', ...)`, `entries/date.ts`'s `formatDate`); if re-creation itself is refused (the Habit Definition or the User is also gone, or the data no longer fits the archetype), it falls through to the same generic 4xx-discard-with-toast path as any other unfixable rejection.
- **Install affordance** — `InstallPrompt` (`frontend/src/pwa/InstallPrompt.tsx`) is a dismissible, design-system card mounted in the app shell. On Android/Chrome it defers `beforeinstallprompt` and triggers the native flow from its own button; on iOS Safari (which never fires that event) it shows manual "Add to Home Screen" guidance. Platform detection and dismissal persistence live in `frontend/src/pwa/install.ts`. It is suppressed when running standalone (already installed), once dismissed (persisted in `localStorage`), or after `appinstalled`.

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
