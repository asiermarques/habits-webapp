---
name: Recurring Issues Patterns
description: Anti-patterns and issues found across multiple slices — use to catch regressions in future reviews
type: project
---

Anti-patterns and issues found after reviewing Slices 0–3 (as of 2026-05-09):

## Silent mutation failures (all feature slices)
Every mutation (create/update/delete) has no `onError` handler or error display in the UI. When the API returns 4xx/5xx, the call fails silently — the user sees no feedback. This affects: `useCreateUser`, `useUpdateUser`, `useDeleteUser`, `useCreateHabitDefinition`, `useUpdateHabitDefinition`, `useDeleteHabitDefinition`, `useCreateEntry`, `useUpdateEntry`, `useDeleteEntry`.

**Why it matters:** Server-enforced business rules (409 Conflict for type-lock, 409 for has_entries, etc.) are never surfaced to the user.

## Missing typeLocked prop in HabitsSection (Slice 2/3 boundary)
`HabitForm` accepts a `typeLocked` prop to disable the type selector, but `HabitsSection` never passes it — even for habits that have entries. The backend will reject type changes with 409, but the UI never shows the type field as locked nor displays an error. The `typeLocked` feature is effectively dead in production.

**Fix needed:** Either pass `typeLocked` based on entry count (requires backend API change to expose hasEntries per definition), or always lock type in edit mode and rely on backend validation.

## Unused dependencies in frontend
`@nivo/bar`, `@nivo/calendar`, `@nivo/core`, and `date-fns` are in `frontend/package.json` dependencies but imported nowhere in `src/`. These are pre-installed for Slices 5–6 but add bundle weight and appear in `npm audit` surface area.

## No delete confirmation for habit definitions
`HabitsSection` deletes a habit immediately on click with no confirmation dialog. Compare with `EntriesList` which uses `AlertDialog` for confirmation. Habit definitions with no entries CAN be deleted — this is a data loss risk.

## TypeScript error in test file hidden by vitest
`backend/src/entries/__tests__/entries.test.ts:138` has a genuine `tsc` error: `e.data.duration` accessed on `EntryData` union type without narrowing. `vitest` transpiles without type-checking, so tests pass. `tsc --noEmit` catches it.

## Documentation drift pattern
ARCHITECTURE.md and the Testing section consistently lag one slice behind. After each slice is completed, the "Routing" table, domain model section preface, and testing coverage list need manual updates.
