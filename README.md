# Habits

[![CircleCI](https://dl.circleci.com/status-badge/img/gh/asiermarques/habits-webapp/tree/main.svg?style=svg)](https://dl.circleci.com/status-badge/redirect/gh/asiermarques/habits-webapp/tree/main)

A simple, mobile-first web app for tracking habits across multiple users — without accounts, logins, or paywalls. Built to consolidate the habits that no single off-the-shelf tracker handled well, and to surface weekly and monthly summaries that inform real lifestyle changes.

This is also a **demo project used in talks and training sessions** about Claude Code harness engineering. The codebase is intentionally kept simple but real and functional so that the workflow patterns demonstrated here reflect actual development conditions.

### Features

- Log habits across three archetypes: **Workout**, **Writing**, and **Custom**
- Multiple named users on the same instance (no auth)
- Editable past entries and backfill for any date
- Home dashboard with a weekly chart and an infinite-scroll history of entries
- Dedicated metrics view: stacked bar chart of entries per archetype over the last 13 weeks, plus per-habit heatmaps over the last 26 weeks (one column on mobile, two on tablet+)
- CSV export for any user and date range
- JSON backup & restore per user (export definitions + entries, re-import with merge/skip-duplicates)
- Pre-seeded example habits to start logging immediately
- Optional single-password instance gate for public deployments (off by default — see env vars below)

### Documentation

See the [docs](./docs) directory:

- [`ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — code structure, layers, conventions
- [`PRODUCT.md`](./docs/PRODUCT.md) — implemented features and product decisions
- [`UBIQUITOUS_LANGUAGE.md`](./docs/UBIQUITOUS_LANGUAGE.md) — canonical domain vocabulary
- [`OBSERVABILITY.md`](./docs/OBSERVABILITY.md) — enabling backend telemetry (OpenTelemetry/OTLP)

### Project structure

```
habitsapp/
├── backend/        Express API, Drizzle schema and migrations, SQLite
├── frontend/       Vite + React app
├── shared/         Types shared between backend and frontend
├── docs/           Architecture, product, and ubiquitous-language docs
├── .claude/        Claude Code agents, skills, and agent memory
└── .workflow/      Output directory for agents and skills
```

### Prerequisites

- Node.js 20+ (developed on 23.5)
- npm 10+ (workspaces required)

### Setup

```bash
git clone <repo-url>
cd habitsapp
npm install
```

Copy the example env files:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### Running

```bash
npm run dev             # starts both backend and frontend
npm run dev:backend     # backend only  — http://localhost:3001
npm run dev:frontend    # frontend only — http://localhost:5173
```

### Database

SQLite file lives at `backend/habits.db` (configurable via `DATABASE_URL`).

```bash
npm run db:generate     # generate migrations from schema changes
npm run db:migrate      # apply pending migrations
```

### Docker (production)

Build and run the app as a single container. The SQLite database is persisted in a named Docker volume so data survives container recreation.

```bash
docker compose up -d           # build (first time) and start in the background
docker compose logs -f app     # stream logs
docker compose down            # stop (data is kept in the volume)
docker compose down -v         # stop AND delete the volume (data lost)
```

The app is available at `http://localhost:8083`. To use a different port:

```bash
PORT=9000 docker compose up -d
```

To build the image manually without docker-compose:

```bash
docker build -t habitsapp .
docker run --rm -p 3001:3001 habitsapp
```

> **Note**: without a volume mount the database lives inside the container and is lost when it stops. Use `docker compose` for persistent deployments.

To migrate existing dev data (`backend/habits.db`) into the Docker volume before the first start:

```bash
docker run --rm \
  -v habitsapp_db-data:/data \
  -v $(pwd)/backend:/src \
  alpine cp /src/habits.db /data/habits.db
```

### Environment variables

Templates live in `backend/.env.example` and `frontend/.env.example` — copy them as shown in [Setup](#setup). Every variable is optional and has a default (the one exception: `SESSION_SECRET` becomes **required** once `GATE_PASSWORD` is set).

#### Backend (runtime — `backend/.env`)

Read by the Node server at startup, so a change takes effect on the next restart.

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | HTTP port the server listens on |
| `DATABASE_URL` | `./habits.db` | Path to the SQLite file (also used by `drizzle-kit` for migrations) |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed CORS origin for the API |
| `NODE_ENV` | _(unset)_ | Set to `production` to serve the built frontend, sign the gate cookie as `Secure`, and emit JSON logs. Also disables seeding under `test` |
| `FRONTEND_DIST_DIR` | `../../frontend/dist` (relative to the compiled backend) | Production only — path to the built frontend assets the server serves |
| `GATE_PASSWORD` | _(unset)_ | Shared password for the instance gate. **Unset = no gate (fully open).** Set it to require an unlock screen before the app |
| `SESSION_SECRET` | _(unset)_ | Random secret used to sign the gate session cookie. **Required when `GATE_PASSWORD` is set** — the server refuses to start gated without it |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | _(unset)_ | OTLP endpoint for traces/metrics/logs. **Unset = telemetry off** (fail-open). Signal-specific overrides `OTEL_EXPORTER_OTLP_{TRACES,METRICS,LOGS}_ENDPOINT` are also honored |
| `OTEL_EXPORTER_OTLP_HEADERS` | _(unset)_ | Headers sent to the OTLP endpoint, e.g. `api-key=…` (secret — never commit a real value) |
| `OTEL_SERVICE_NAME` | `habits-backend` | Service name reported to the telemetry backend |

See [`docs/OBSERVABILITY.md`](docs/OBSERVABILITY.md) for the full telemetry setup.

> ⚠️ **Deploying publicly?** The instance has **no gate by default** — anyone with the URL can read and write every user's data. Before exposing a public URL (Railway, a free tier, etc.), set **both** `GATE_PASSWORD` and `SESSION_SECRET` in the host's dashboard. This adds a single shared-password unlock screen (a ~24h session per browser); it is a deployment safeguard, not per-user authentication. Both are set in the environment only — no rebuild, nothing committed to the repo.

#### Frontend (build-time — `frontend/.env`)

Baked into the bundle at `vite build`, so a change requires a **rebuild** to take effect (not just a restart).

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3001` | Base URL of the backend API the SPA calls |
| `GATE_OFFLINE_GRACE_MINUTES` | `120` (2h) | How long a gated instance stays readable offline after the last online unlock; past it the unlock screen is shown. A missing/non-numeric/non-positive value falls back to the default |

### Testing

**Type check** (TypeScript — all workspaces):

```bash
npm run typecheck
```

**Unit tests** (Vitest — backend + frontend):

```bash
npm test
```

**E2E tests** (Playwright — Chromium, full stack):

```bash
npm run test:e2e:install   # download Chromium binary (run once after clone)
npm run test:e2e           # run the suite
npm run test:e2e:ui        # open Playwright UI mode
```

E2E tests run against a separate database (`backend/habits.e2e.db`) and start their own backend (port 4001) and frontend (port 4173) so they never touch the dev environment.

## License

[MIT](./LICENSE)