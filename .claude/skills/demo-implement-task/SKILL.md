---
name: demo-implement-task
description: Implement a coding task end-to-end using strict TDD (red → green → refactor), then run the full test suite and update the project documentation. Use when the user provides a task description and asks for it to be implemented.
disable-model-invocation: true
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
---

This skill drives the implementation of a single, well-scoped coding task in the habits app. The user provides the task as the skill argument (e.g. `/demo-implement-task add an "archive habit" action that hides a habit from the picker without deleting it`). The skill is responsible for delivering working, tested, documented code — not for inventing scope.

## Inputs

- **The task description** — passed as the skill argument. Treat it as the source of truth for what to build. If it is ambiguous in a way that affects the data model, public API, or user-facing behavior, ask the user **one** clarifying question before writing code. Do not ask about implementation details you can decide yourself.

## Operating principles

This project values:

- **Vertical slices.** A feature ships end-to-end (DB → API → UI) in one go, not layer by layer. Don't stop at the backend.
- **Strict TDD.** Tests are written first, fail first, then code makes them pass. No exceptions.
- **Layered backend.** Each command slice has `domain/` (pure), `infrastructure/` (Drizzle adapter, owns transactions), `http/` (router factory + Zod schemas), and `__tests__/` (vitest + supertest). Respect those boundaries.
- **Tokens, not raw colors.** All UI work follows `docs/DESIGN.md`. Never introduce raw Tailwind palette classes (`neutral-*`, `red-*`, etc.) — always go through the design tokens.
- **No goals or targets in metrics.** Counts only. This is a product decision, not an oversight.

Read these before touching code:

- `CLAUDE.md` — conventions, layering, prohibited patterns
- `docs/PRODUCT.md` — current scope (is this already implemented? is it explicitly out of scope?)
- `docs/ARCHITECTURE.md` — file layout and conventions
- `docs/DESIGN.md` — design system for any UI touched
- `docs/UBIQUITOUS_LANGUAGE.md` — use the canonical names in code, tests, and copy

## The TDD loop

For every layer the task touches, apply red → green → refactor:

### 1. Plan the slice

Before writing any code, write down (in your head or as a TaskCreate list):

- Which slice(s) are involved? (`users/`, `habit-definitions/`, `entries/`, `settings/`, `metrics/`, `export/`)
- What's the minimal **observable** behavior change? (What does the user see or what does an API caller get?)
- Which layer needs new types? Which layer needs a new repository method? Which router gets a new route?
- What's the smallest end-to-end test that proves the feature exists? **Start there.**

### 2. Write the first failing test

Always start at the outermost meaningful layer for the change:

- Feature touches the API → write a `__tests__/<slice>.test.ts` integration test using `supertest` against `createXxxRouter(repo)`.
- Feature is pure domain logic (invariants, validation) → write a domain unit test that constructs values and asserts the invariant function throws/passes.
- Feature is UI-only (visual or interaction) → write a `__tests__/<Component>.test.tsx` using the test utils in `frontend/src/test/`.

Run the test. **Confirm it fails for the right reason** (assertion fails, not "module not found" buried under other errors). If it fails for the wrong reason, fix that first.

### 3. Make it green

Write the minimum code to pass. Move down the layers as needed:

- Domain types and invariant functions first (pure, sync, throw `DomainError` subclasses)
- Repository port (TypeScript interface in `domain/`)
- Drizzle adapter in `infrastructure/` (this is the only place `db.transaction(...)` is allowed)
- HTTP route in `http/` using `validateBody` / `validateQuery` (never hand-roll `req.body` checks)
- Frontend: TanStack Query hook in `<slice>/queries.ts`, then component

Run the test after each meaningful step. Don't stack unverified layers.

### 4. Refactor

Once green, look at what you wrote. Remove duplication, tighten names, delete dead branches. **Don't add features, error handling for impossible cases, or abstractions for hypothetical futures.** Three similar lines beats a premature helper.

Re-run the test. It must still pass.

### 5. Repeat for the next observable behavior

Add the next failing test (edge case, error path, second user-facing variation). Loop until the task is complete.

## When the implementation is complete

**Mandatory closing sequence — do not skip any step.**

### 1. Run the full test suite

```bash
npm test
```

It must run **both backend and frontend workspace suites** and exit clean. If anything is red:

- A test you didn't write failed → you broke something unrelated. Investigate and fix the root cause; don't disable the test.
- Your own test fails after a refactor → the refactor was wrong; revert or fix.

Don't declare the task done while tests are red.

### 2. Update the workflow files (if they exist for this task)

This project uses `.workflow/` for the upstream artifacts that birthed the task:

- `.workflow/requisites/<NNN>-<slug>.md` — the feature requisites
- `.workflow/implementation-plans/<NNN>-<slug>.md` — the implementation plan
- `.workflow/tasks/<NNN>-<slug>/US-NNN.md` — the individual user-story tasks

Before declaring the implementation complete:

1. **Locate the parent feature.** If the task description references a user story (e.g. `US-002`), a feature slug, or a feature number, search `.workflow/tasks/`, `.workflow/requisites/`, and `.workflow/implementation-plans/` for the matching `<NNN>-<slug>`. If the task description doesn't name one, ask the user which feature it belongs to before continuing (or confirm there's no associated workflow artifact).
2. **Update the task file** (`.workflow/tasks/<NNN>-<slug>/US-NNN.md`): mark the user story as completed, note any scope deviations, and record which test files prove it.
3. **Update the implementation plan** (`.workflow/implementation-plans/<NNN>-<slug>.md`): tick off the step(s) the task covered. If the plan was wrong in a way that mattered (a step turned out to be unnecessary, or a new step had to be added), update the plan to reflect what actually happened — the plan is a living document, not a historical record.

If none of these files exist (or the task is unrelated to any feature in `.workflow/`), say so in the summary and skip this step. Don't create workflow files defensively.

### 3. Update the documentation

The project's `CLAUDE.md` is explicit: when implementation diverges from the public docs, the docs must be updated. Walk each doc and update it as needed:

- **`docs/PRODUCT.md`** — if the task added/changed/removed a user-facing feature, update the "Features available" bullets. If the task touched a deliberate constraint, update "Product decisions worth knowing".
- **`docs/ARCHITECTURE.md`** — if the task added a new slice, a new layer convention, or a new shared utility worth knowing about, mention it here. Do not narrate routine changes.
- **`docs/UBIQUITOUS_LANGUAGE.md`** — if the task introduced new domain vocabulary (a new entity, archetype, or status), add it here with its canonical name and any aliases to avoid.
- **`docs/DESIGN.md`** — if the task added new tokens, utilities, components, or rules to the design system, update this too.
- **`README.md`** — usually only if commands or quick-start changed.

If none of the docs need updating, say so explicitly in the final summary — don't quietly skip.

### 4. Summary to the user

Report back with:

- A one-line description of what shipped
- The test command and the result (pass count or "all suites pass")
- Which workflow files were updated (task file, plan, requisites) — or "no associated workflow artifact"
- Which docs were updated (or "no doc changes needed because …")
- Anything explicitly **not** implemented that the task description could have implied — give the user a chance to redirect
- Any **requisites changes** — flag these prominently so the user can validate them

## Hard rules — never violate

- **No code before a failing test.** If you find yourself typing `export function` before there's a red test, stop and write the test.
- **No skipping `npm test` at the end.** Even if the tests you wrote pass in isolation, the full suite catches the rest.
- **No raw color classes in UI.** `bg-neutral-*`, `text-red-*`, `border-gray-*` etc. are banned. Use design tokens from `docs/DESIGN.md`.
- **No `db.transaction()` outside Drizzle adapters.**
- **No hand-rolled `req.body` checks in routes.** Always go through `validateBody` / `validateQuery` with a Zod schema.
- **No commits.** Implement and report. Only commit when the user explicitly asks.
- **No silent doc drift.** If you change observable behavior and don't update PRODUCT.md, you didn't finish the task.
- **No silent workflow drift.** If the task came from a `.workflow/` artifact, update it. Don't leave the plan or task file pointing at a past reality.

## Anti-patterns to refuse

- Writing all the code, then writing tests at the end. That's not TDD — that's test-after, and it produces tests that confirm what you already wrote rather than tests that drive design.
- Stubbing out future work with `// TODO` comments. Either implement it now (if it's in scope) or don't reference it (if it's not).
- Adding feature flags, backwards-compatibility shims, or "in case we need it later" parameters.
- Catching and re-throwing errors with no added context. Let them propagate.
- Adding new dependencies for problems the existing stack already solves.
