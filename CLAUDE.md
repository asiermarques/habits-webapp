# Project: Habits

Mobile-first web app for tracking habits across multiple unauthenticated users. Built incrementally through vertical slices.

## Project documentation

**Public docs (committed, describe the current implemented state):**

- `docs/ARCHITECTURE.md` — code structure, layers, conventions, commands. Read this first when orienting in the codebase.
- `docs/PRODUCT.md` — what the app actually does today vs. what's still planned. Source of truth for "is X implemented?"

When the implementation diverges from `ARCHITECTURE.md` or `PRODUCT.md` or `README.md`, update those public docs too — they should always reflect reality.

## Conventions

- **Mobile-first** — design and CSS classes target mobile viewports first; only add larger-breakpoint variants when needed
- **Vertical slices** — each feature is delivered end-to-end (DB → API → UI) in one go, not layer by layer. 
- **Path alias** — `@/*` maps to `frontend/src/*`
- **Tests live next to the code** in `__tests__/` folders
- **No goals or targets** in the metrics layer — only raw counts (this is a deliberate product decision)

## Context7 — fetch up-to-date library docs

When working with libraries, frameworks, SDKs, or CLI tools, use the Context7 MCP server to fetch current documentation — even for well-known libraries like React, Drizzle, Tailwind, shadcn, or Vite. Local training data may be outdated, especially for fast-moving libraries (Tailwind v4 and shadcn/ui have both had recent breaking changes).

Steps:
1. `mcp__context7__resolve-library-id` with the library name and the user's question
2. Pick the best-matching `/org/project` ID (prefer high reputation, high snippet count)
3. `mcp__context7__query-docs` with the library ID and the full question
4. Answer using the fetched docs

Skip Context7 only for: generic programming concepts or debugging business logic

## Common commands

```bash
npm install                # installs all workspaces
npm run dev                # starts both backend and frontend
npm run dev:backend        # backend only
npm run dev:frontend       # frontend only
npm test                   # runs all workspace test suites
npm run db:generate        # generate Drizzle migrations from schema changes
npm run db:migrate         # apply pending migrations
```


## Things to avoid

- **Don't add Tailwind v3 patterns** — this project uses v4; config lives in `index.css` via `@theme inline`, not in a `tailwind.config.js`.
- **Don't add features beyond the current slice** — finish the slice end-to-end first.
