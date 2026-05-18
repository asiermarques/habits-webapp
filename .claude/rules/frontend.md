---
paths:
  - "frontend/src/**/*.ts"
  - "frontend/src/**/*.tsx"
---

Frontend conventions beyond the provider/query/locale rules in `CLAUDE.md` and `docs/ARCHITECTURE.md`. Read those first; this file only adds prescriptive guidance not already there.

## Data fetching

- All HTTP goes through `apiFetch<T>` from `@/lib/api`. No raw `fetch()`, no `axios`, no other clients.
- All server state lives in TanStack Query. Don't load data in `useEffect` and store it in `useState` — use `useQuery` / `useInfiniteQuery`.
- Each feature folder owns a `queries.ts` exporting its hooks and the `<feature>Key(...)` builder. Don't inline query keys in components.
- Gate user-scoped queries on `userId > 0` via `enabled` — `useUserContext()` returns `0` before a user is selected.
- Mutations never show their own error toasts; the `MutationCache.onError` in `main.tsx` does it globally. Only handle errors inline for UX state (disabling a button, showing inline validation).

## Components and styling

- Compose classes with `cn()` from `@/lib/utils`. Don't concatenate strings or use template literals for conditional classes.
- Reuse the shadcn primitives in `components/ui/`. If a primitive isn't installed, install it via shadcn rather than building from scratch — except for `date-picker.tsx`, which is intentionally in-house.
- No new CSS files. Tailwind utility classes and the tokens in `index.css` are the only styling surface. If you need a new color or radius, add a token under `@theme inline` in `index.css`.
- Mobile-first: write the base classes for mobile, add `sm:` / `md:` / `lg:` variants only when a wider viewport actually needs them.

## i18n and formatting

- All user-facing strings go through `t(key)` from `@/lib/i18n`. No hardcoded English in JSX, no string literals as button labels.
- Add new keys to both `en` and `es` dictionaries in `i18n.ts`. The `en` dictionary is the type source — missing `es` keys surface as type errors.
- Date and number formatting always passes `getLocale()` from `@/lib/locale`. Never call `Intl.*` or `toLocale*` with `undefined` as the locale argument.

## Forms and dialogs

- Reuse `LogEntryDialog` via `useLogEntryDialog()` rather than mounting a second copy of the entry form.
- Form state is `useState` per field for small forms; reach for a form library only if the form grows past ~5 fields with cross-field validation. None currently do.
- Client-side validation mirrors the backend Zod schema's shape (required vs optional, numeric ranges) so the happy path doesn't round-trip a 400.

## Routes

- Three routes exist: `/`, `/metrics`, `/settings`. Don't add new top-level routes for a feature without confirming with the user — most additions belong inside an existing page or a dialog.

## Active user

- Read the active user via `useUserContext()`. Don't read `localStorage` directly — `UserProvider` owns persistence.
- If a feature needs to react to user switches, depend on `userId` in your query key (already the convention); avoid manual `useEffect` resets.
