# Architecture

This document describes the **current implemented state** of the codebase.

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
- **Config**: `dotenv` loads `backend/.env`. Variables: `PORT` (default 3001), `DATABASE_URL` (default `./habits.db`), `CORS_ORIGIN` (default `http://localhost:5173`).
- **Dev runner**: `tsx watch src/index.ts`

### Database layer

- **Engine**: SQLite via `better-sqlite3`
- **ORM**: Drizzle (`drizzle-orm/better-sqlite3`)
- **Connection** (`src/db/index.ts`):
  - Opens the DB file from `DATABASE_URL`
  - Applies `journal_mode = WAL` and `foreign_keys = ON`
  - Exports a `db` instance with the schema attached
- **Schema** (`src/db/schema.ts`): currently `users` table (`id`, `name`, `is_default`, `created_at`).
- **Migrations**: managed by `drizzle-kit`, output to `backend/drizzle/`. Generate with `npm run db:generate`, apply with `npm run db:migrate`. Also applied automatically on backend startup via `runMigrations()` in `src/db/migrate.ts`.

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
- `button.tsx`, `input.tsx`, `select.tsx`, `dialog.tsx`
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

- **Backend**: Vitest + supertest. Setup file at `src/test/setup.ts` runs migrations against an in-memory SQLite (`DATABASE_URL=:memory:` set in `vitest.config.ts`) and truncates the users table before each test. Tests live in `backend/src/**/__tests__/`. Covers `/health` and the full Users API (CRUD, default-user invariants).
- **Frontend**: Vitest + jsdom + `@testing-library/react` + `@testing-library/jest-dom`. Setup file at `src/test/setup.ts` registers matchers and per-test cleanup. `src/test/test-utils.tsx` exports a `TestProviders` wrapper (QueryClient + Router + UserProvider) used by component tests. Tests live in `src/**/__tests__/`. Covers the `Header` component (route-conditional rendering, switcher visibility based on user count) and `apiFetch` (parses JSON, serializes body, throws on error).

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
