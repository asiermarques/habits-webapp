# Habits

A simple, mobile-first web app for tracking habits across multiple users — without accounts, logins, or paywalls. Built to consolidate the habits that no single off-the-shelf tracker handled well, and to surface weekly and monthly summaries that inform real lifestyle changes.

## Features

- Log habits across three archetypes: **Workout**, **Writing**, and **Custom**
- Multiple named users on the same instance (no auth)
- Editable past entries and backfill for any date
- Home dashboard with top habits and totals
- Dedicated metrics view with bar charts and per-habit heatmaps
- CSV export for any user and date range
- Pre-seeded example habits to start logging immediately

## Tech stack

- **Frontend**: React + TypeScript, Vite, Tailwind CSS v4, shadcn/ui, TanStack Query, React Router, Nivo
- **Backend**: Express + TypeScript, Drizzle ORM, SQLite
- **Tooling**: npm workspaces, tsx, drizzle-kit

See [`tech-stack.md`](./tech-stack.md) for the full breakdown and rationale.

## Project structure

```
habitsapp/
├── backend/        Express API, Drizzle schema and migrations, SQLite
├── frontend/       Vite + React app
├── shared/         Types shared between backend and frontend
├── project-scope.md
├── tech-stack.md
└── implementation-plan.md
```

## Prerequisites

- Node.js 20+ (developed on 23.5)
- npm 10+ (workspaces required)

## Setup

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

## Running

Start both apps in separate terminals:

```bash
npm run dev:backend     # http://localhost:3001
npm run dev:frontend    # http://localhost:5173
```

Or run both together:

```bash
npm run dev
```

## Database

SQLite file lives at `backend/habits.db` (configurable via `DATABASE_URL`).

```bash
npm run db:generate     # generate migrations from schema changes
npm run db:migrate      # apply pending migrations
```

## Documentation

- [`project-scope.md`](./project-scope.md) — product decisions and feature scope
- [`tech-stack.md`](./tech-stack.md) — library choices and reasoning
- [`implementation-plan.md`](./implementation-plan.md) — vertical slices and progress

## License

[MIT](./LICENSE)
