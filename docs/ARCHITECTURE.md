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

A globally-shared catalogue of habits. All users see the same definitions.

| Field | Type | Notes |
|---|---|---|
| `id` | integer PK | autoincrement |
| `name` | text | display name |
| `type` | enum | `workout` \| `writing` \| `custom` |
| `positive` | boolean | direction; drives metric framing and heatmap color |
| `color` | text | hex; auto-assigned at creation |
| `createdAt` | text | timestamp |

Invariants enforced in `backend/src/habit-definitions/repository.ts`:
- Workout and Writing are **always** positive (`positive` is forced to true regardless of input)
- Custom is the only type with a meaningful `positive` flag
- Color is auto-assigned at creation:
  - Negative → red (`#ef4444`)
  - Positive → next color in the rotating 8-color palette, based on the count of existing positive habits
- Type cannot change once entries reference the definition → HTTP 409
- Definitions with existing entries cannot be deleted → HTTP 409
- The last two checks call a `hasEntriesForDefinition()` placeholder that returns `false` until Slice 3 wires up the entries table

### HabitEntry — planned (Slice 3)

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
| `amount` | optional |
| `notes` | optional |

**WritingData** (`entry_writing_data`)
| Field | Required |
|---|---|
| `words` | yes |
| `time` | optional |

**CustomData** (`entry_custom_data`)
| Field | Required |
|---|---|
| `number` | optional |
| `amount` | optional |
| `duration` | optional |
| `binary` | optional |

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
│   │   │   ├── repository.ts  CRUD against the users table (transactions)
│   │   │   ├── routes.ts      Express router for /users
│   │   │   └── __tests__/
│   │   ├── habit-definitions/ Slice 2: habit definitions feature
│   │   │   ├── colors.ts      positive palette + red for negative; pickColor()
│   │   │   ├── repository.ts  CRUD with type-lock and entry-protection placeholders
│   │   │   ├── routes.ts      Express router for /habit-definitions
│   │   │   ├── seed.ts        first-run seed of eight example habits
│   │   │   └── __tests__/
│   │   ├── test/setup.ts   Vitest setup: in-memory DB + table reset per test
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
│   │   ├── pages/          Home, Metrics, Settings
│   │   ├── lib/
│   │   │   ├── api.ts      apiFetch wrapper
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
  - `GET /habit-definitions`, `POST /habit-definitions`, `PUT /habit-definitions/:id`, `DELETE /habit-definitions/:id`
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
  - `habit_definitions` (`id`, `name`, `type` enum: workout/writing/custom, `positive`, `color`, `created_at`)
- **Migrations**: managed by `drizzle-kit`, output to `backend/drizzle/`. Generate with `npm run db:generate`, apply with `npm run db:migrate`. Also applied automatically on backend startup via `runMigrations()` in `src/db/migrate.ts`.
- **Seeding**: on backend startup, after migrations, `seedHabitDefinitions()` runs and inserts the eight example habits if the table is empty.

## Frontend

- **Build tool**: Vite 5 (port 5173)
- **Plugins**: `@vitejs/plugin-react`, `@tailwindcss/vite`
- **Path alias**: `@/*` → `src/*` (defined in both `tsconfig.json` and `vite.config.ts`)

### Entry & providers

`src/main.tsx` mounts (in order, outer → inner):
1. `React.StrictMode`
2. `QueryClientProvider` (TanStack Query, `staleTime: 30s`, no refetch on focus)
3. `BrowserRouter`
4. `<App />`

### Routing

`src/App.tsx` defines three routes:
| Path | Component | Purpose |
|---|---|---|
| `/` | `Home` | Default; demonstrates API connectivity by calling `/health` |
| `/metrics` | `Metrics` | Placeholder for Slice 5 |
| `/settings` | `Settings` | Placeholder for Slices 1–2 |

### Header

`src/components/Header.tsx` is sticky and mobile-friendly. It conditionally renders:
- **On `/`**: app title + Metrics icon + Settings icon (Lucide `BarChart3`, `Settings`)
- **On any other route**: back arrow that navigates home (Lucide `ArrowLeft`)

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
- `button.tsx`, `input.tsx`, `select.tsx`, `dialog.tsx`, `dropdown-menu.tsx`, `switch.tsx`, `label.tsx`
- Use `cn()` from `@/lib/utils` (clsx + tailwind-merge) to compose classes
- Use the `radix-ui` umbrella package for primitives (Slot, Dialog, Select)

### API client

`src/lib/api.ts` exports a single `apiFetch<T>(path, options)` function that:
- Prefixes `path` with `import.meta.env.VITE_API_URL`
- Defaults to `Content-Type: application/json`
- Serializes the body with `JSON.stringify` when provided
- Throws on non-2xx responses
- Returns `response.json()` typed as `T`

## Shared types

`shared/src/index.ts` is imported as `@habitsapp/shared` from both backend and frontend. Currently exports only `HealthResponse`. The package has no build step — both apps consume the `.ts` source directly.

## Communication

- REST + JSON
- Backend allows requests from `CORS_ORIGIN` (default `http://localhost:5173`)
- Frontend targets `VITE_API_URL` (default `http://localhost:3001`)

## Testing

- **Backend**: Vitest + supertest. Setup file at `src/test/setup.ts` runs migrations against an in-memory SQLite (`DATABASE_URL=:memory:` set in `vitest.config.ts`) and truncates `users` and `habit_definitions` before each test. Tests live in `backend/src/**/__tests__/`. Covers `/health`, the Users API (CRUD + default-user invariants), and the Habit Definitions API (CRUD, color rotation, positive-flag enforcement, seeding behavior).
- **Frontend**: Vitest + jsdom + `@testing-library/react` + `@testing-library/jest-dom`. Setup file at `src/test/setup.ts` registers matchers, per-test cleanup, and a `ResizeObserver` polyfill (Radix UI primitives need it). `src/test/test-utils.tsx` exports a `TestProviders` wrapper (QueryClient + Router + UserProvider) used by component tests. Tests live in `src/**/__tests__/`. Covers the `Header` (route-conditional rendering, switcher visibility), `apiFetch` (parses JSON, serializes body, throws on error), and `HabitForm` (positive-toggle visibility per type, name trimming, type-lock behavior).

## Commands

```bash
npm install                  # install all workspaces
npm run dev                  # both backend and frontend
npm run dev:backend          # backend only (port 3001)
npm run dev:frontend         # frontend only (port 5173)
npm test                     # all workspace tests
npm run build                # production builds
npm run db:generate          # generate Drizzle migrations
npm run db:migrate           # apply pending migrations
```
