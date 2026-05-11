# Habits

A simple, mobile-first web app for tracking habits across multiple users — without accounts, logins, or paywalls. Built to consolidate the habits that no single off-the-shelf tracker handled well, and to surface weekly and monthly summaries that inform real lifestyle changes.

This is also a **demo project used in talks and training sessions** about Claude Code harness engineering. The codebase is intentionally kept simple but real and functional so that the workflow patterns demonstrated here reflect actual development conditions.

## Claude Code workflow

This repo demonstrates a Claude Code workflow built around **agents**, **skills**, and **memory**.

### Agent: `project-reviewer`

A custom sub-agent defined in `.claude/agents/project-reviewer.md`. When invoked, it performs a structured multi-dimensional review of recently modified code — covering code quality, tests, performance, product alignment, security, and documentation accuracy. It writes its report to `.workflow/review/project-review.md` and maintains persistent memory in `.claude/agent-memory/project-reviewer/`.

### Skills

Skills are reusable prompt modules that can be composed or invoked in conversation:

| Skill | Purpose |
|-------|---------|
| `demo-take-requirements` | Reads product/architecture docs, asks clarifying questions, and writes a requirements file to `.workflow/requisites/<feature-slug>.md` |
| `demo-create-implementation-plan` | Turns a requirements file into a vertical-slice plan with user story files under `.workflow/tasks/<feature-slug>/` |
| `project-review-methodology` | Applies the standard review checklist across six dimensions |
| `project-review-security` | Focuses on input validation, multi-user data isolation, XSS, and SQL safety |
| `project-review-testing` | Audits test coverage for edge cases, error paths, and vertical-slice completeness |
| `project-review-docs-consistency` | Checks whether `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, and READMEs match the actual implementation |

The review skills are orchestrated by the `project-reviewer` agent and are not meant to be invoked directly.

### Workflow directory

`.workflow/` holds the output produced by agents and skills. Subdirectories are created on demand the first time a given skill or agent runs:

- `requisites/` — feature requirement files (written by `demo-take-requirements`)
- `tasks/` — user story files per feature (written by `demo-create-implementation-plan`)
- `review/` — review reports (written by the `project-reviewer` agent)

The directory may also contain ad-hoc working files (for example, `implementation-plan.md`) that aren't produced by any specific skill.

---

## The app

### Features

- Log habits across three archetypes: **Workout**, **Writing**, and **Custom**
- Multiple named users on the same instance (no auth)
- Editable past entries and backfill for any date
- Home dashboard with a weekly chart and an infinite-scroll history of entries
- Dedicated metrics view: stacked bar chart of entries per archetype over the last 13 weeks, plus per-habit heatmaps over the last 26 weeks (one column on mobile, two on tablet+)
- CSV export for any user and date range
- Pre-seeded example habits to start logging immediately

### Documentation

See the [docs](./docs) directory for architecture and product feature details.

### Project structure

```
habitsapp/
├── backend/        Express API, Drizzle schema and migrations, SQLite
├── frontend/       Vite + React app
├── shared/         Types shared between backend and frontend
├── docs/           Architecture and product docs
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

### Testing

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