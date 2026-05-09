---
name: Documentation Drift After Slice 3
description: Specific ARCHITECTURE.md and README.md gaps identified after Slice 3 completion
type: project
---

Gaps identified on 2026-05-09 after Slices 0–3 completion:

## ARCHITECTURE.md gaps

1. **Line 7** — "HabitEntry lands in Slice 3" reads as future tense. Should say "HabitEntry was delivered in Slice 3" or just remove the parenthetical now that all three entities are implemented.

2. **Lines 231–233** — Routing table stale: Home described as "demonstrates API connectivity by calling /health" (was Slice 0); Settings described as "Placeholder for Slices 1–2". Both are now fully implemented. Update to describe actual current content.

3. **Lines 279–280** — Testing section does not mention the Entries API tests (17 tests in `entries/__tests__/`) or the `EntryForm` frontend tests (6 tests). Only mentions health, Users, and HabitDefinitions for backend; Header, apiFetch, and HabitForm for frontend.

4. **Line 279** — Says setup "truncates `users` and `habit_definitions` before each test" — should also mention `entries`, `entry_workout_data`, `entry_writing_data`, `entry_custom_data`.

5. **Provider mounting order** — The "Entry & providers" section lists 4 items ending with `<App />` but doesn't mention that `UserProvider` wraps content inside `App.tsx`. This is not covered in the provider stack description.

## README.md gaps

1. **Lines 21, 30–31, 81–83** — References `project-scope.md`, `tech-stack.md`, `implementation-plan.md` as root-level files and in the project structure tree. All three are in `docs/local/` not root. Links are broken.

2. **Project structure diagram** — Shows `shared/`, `backend/`, `frontend/`, `project-scope.md`, `tech-stack.md`, `implementation-plan.md` — last three don't exist at root level.

## Metrics.tsx

- Says "Bar charts, heatmaps and CSV export will live here (Slices 5–6)" — CSV export is Slice 6, not part of the Metrics view (Slice 5). Minor but technically inaccurate per PRODUCT.md.
