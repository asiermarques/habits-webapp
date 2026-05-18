---
paths:
  - "backend/src/**/*.ts"
---

Backend conventions beyond the slice rules in `CLAUDE.md` and `docs/ARCHITECTURE.md`. Read those first; this file only adds prescriptive guidance not already there.

## Repository methods

- Multi-user repository methods take `userId` as the first or named parameter and filter by it. No exceptions — this is the only boundary between users.
- A repo method that takes an entity id without a `userId` is a bug unless the entity is global (`users`, `app_settings`).
- Drizzle adapters catch driver errors (`SQLITE_CONSTRAINT_FOREIGNKEY`, unique-index violations) and map them to the appropriate `DomainError`. Never let raw driver errors reach the HTTP layer.

## HTTP route handlers

- Keep handlers thin: `validateBody`/`validateQuery` → call repo → respond. No business logic inline.
- Use `z.coerce.number()` for numeric query params (they arrive as strings) and `z.number()` for body fields.
- Validate ISO dates with `ISO_DATE_RE` from `shared/domain/value-objects/IsoDate.ts`. Don't reinvent the regex.
- List endpoints that support pagination return `{ items: T[], nextCursor: string | null }`. Cursor is base64url JSON; reuse the existing helpers in `entries/http/schemas.ts` as the model.

## Value objects and dates

- Cross boundaries (HTTP ↔ domain ↔ DB) using the branded value objects in `shared/domain/value-objects/` (`IsoDate`, `CurrencyCode`, `LocaleCode`). Construct with the provided factory; don't `as`-cast raw strings elsewhere.
- All dates on the wire and in DB columns are `YYYY-MM-DD`. Don't introduce other formats; don't do date math on raw strings — go through `IsoDate`.

## Cross-slice composition

- A slice never imports another slice's `domain/` or `infrastructure/`. If you need data from another slice, accept its repository port as a constructor/factory parameter and wire it in `app.ts`.
- Read-model slices (`metrics/`, `export/`) may read from any table via Drizzle directly — they have no domain layer by design — but they still take `userId` filters on every query.

## Migrations

- Never edit a Drizzle migration after it has been applied anywhere (including local dev DBs you've committed). Generate a new one with `npm run db:generate` and review the SQL.
- Schema changes require a migration in the same PR. `runMigrations()` runs on startup; an unmigrated schema change breaks every environment on boot.

## Errors

- Throw `DomainError` subclasses (`NotFoundError`, `ConflictError`, `ValidationError`, `ForbiddenError`) — see the mapping table in `ARCHITECTURE.md`. Never return error sentinel objects like `{ ok: false }` or `{ status: 'not_found' }`.
- Don't catch a `DomainError` just to re-throw a different one. Let it propagate to `domainErrorHandler`.
