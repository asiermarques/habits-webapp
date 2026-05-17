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
- Pre-seeded example habits to start logging immediately

### Documentation

See the [docs](./docs) directory:

- [`ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — code structure, layers, conventions
- [`PRODUCT.md`](./docs/PRODUCT.md) — implemented features and product decisions
- [`UBIQUITOUS_LANGUAGE.md`](./docs/UBIQUITOUS_LANGUAGE.md) — canonical domain vocabulary

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

Environment variables (all optional, have defaults):

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | HTTP port the server listens on |
| `DATABASE_URL` | `./habits.db` | Path to the SQLite file |
| `CORS_ORIGIN` | `*` | Allowed CORS origin |
| `FRONTEND_DIST_DIR` | `/app/frontend-dist` | Path to the compiled frontend assets |

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