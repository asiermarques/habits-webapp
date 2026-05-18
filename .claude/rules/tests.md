---
paths:
  - "**/__tests__/**/*.ts"
  - "**/__tests__/**/*.tsx"
---

Test conventions for both backend (Vitest + supertest) and frontend (Vitest + RTL). Read `docs/ARCHITECTURE.md` § Testing for the runner setup; this file is for how to *write* the tests.

## Shared

- One behavior per `it(...)`. If you find yourself writing `// and also...`, split the test.
- Don't share mutable state between tests. Each test seeds what it needs. The test setup truncates tables (backend) or runs cleanup (frontend) between tests — rely on that, don't paper over it.
- Test names describe behavior in plain English: `it('rejects creating an entry for another user\'s habit')`, not `it('returns 403')`.
- Assert at the right level: HTTP status + body shape for routes, return value or thrown error for domain functions, rendered output for components. Don't assert internal state.

## Backend (supertest)

- Hit the app via the `createApp()` factory — never bind a port. `request(app)` is the canonical entry.
- Use the real Drizzle adapter against the in-memory SQLite from `test-setup.ts`. **Don't mock the repository port** in http tests; the integration is the point.
- For setup, call the same HTTP endpoints a real client would (`POST /users`, then `POST /habit-definitions`, then the test). Don't reach into the DB to seed unless you're specifically testing a migration or repository edge case.
- Cover the cross-user 403 path on every multi-user endpoint that takes an entity id. This is the load-bearing security invariant.
- Assert response body shape with `expect(body).toMatchObject({...})` — full equality is brittle for fields like `createdAt`.

## Frontend (RTL)

- Wrap components in `TestProviders` from `src/test/test-utils.tsx` (QueryClient + UserProvider + LogEntryDialogProvider). Add a `MemoryRouter` only when the component reads from `react-router`.
- Prefer `findBy*` (which awaits) over `waitFor(() => getBy*)`. Use `getBy*` only for elements present on first render.
- Query by role and accessible name first (`getByRole('button', { name: /save/i })`), then by label, then by text. `getByTestId` is a last resort.
- Nivo charts are globally mocked — assert against the `data` / `keys` / `colors` props the mock receives, not against SVG output.
- For mutation tests, mock `apiFetch` at the module boundary; don't mock TanStack Query internals.
- Don't add `act(...)` wrappers manually. RTL's user-event API handles it; if you're getting act warnings, you're missing an `await`.
