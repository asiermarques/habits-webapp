---
name: Project Architecture Decisions
description: Intentional design choices that should not be flagged as bugs — explains why-things-are-the-way-they-are
type: project
---

Key intentional architectural decisions in the habitsapp (as of Slice 3 completion):

- **No authentication** — Users are just names on a list; userId is passed as query params/body, not derived from session. This is by design.
- **No goals or targets** — Metrics layer shows only raw counts. Never suggest adding targets.
- **No categories** — Cut from MVP; do not propose adding them.
- **Habit definitions are global** — All users share the same habit catalogue. Not a bug.
- **Active user is client-side state** — Persisted in localStorage under `habitsapp.activeUserId`. Lost on other browsers/devices, intentionally.
- **Cross-user entry access** — PUT /entries/:id and DELETE /entries/:id have no ownership check. In this unauthenticated app this is acceptable but worth flagging as a low-priority concern since any user can edit any entry by ID.
- **SQLite + better-sqlite3** — Synchronous SQLite. WAL mode enabled. No connection pooling needed.
- **No migration rollback** — Drizzle-kit generates forward-only migrations; no down migrations.
- **Seed runs on startup** — `seedHabitDefinitions()` is idempotent (checks if table is empty first).

**Why:** Deliberate product decisions made during scoping to keep the app simple and focused.
**How to apply:** Do not flag these as missing features. Focus on correctness within these constraints.
