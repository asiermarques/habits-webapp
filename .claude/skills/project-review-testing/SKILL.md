---
name: project-review-testing
description: Review test coverage and test quality for the habits app, focusing on edge cases, error paths, integration scenarios, and vertical-slice completeness.
user-invocable: false
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
---

# Project test review

Use this skill to review whether the implementation is sufficiently tested.

## Required context

Read first:

- `docs/PRODUCT.md`
- `docs/ARCHITECTURE.md`

Remember:

- Tests live in `__tests__/` folders next to the code.
- The architecture is vertical-slice oriented.
- Testing should cover behavior, not just implementation details.
- The app supports multiple unauthenticated users.

## Review checks

Look for missing or weak tests around:

- Empty states.
- Null or undefined values.
- Invalid inputs.
- Boundary values.
- Duplicate entities.
- Invalid dates.
- Network or API failures.
- Backend validation failures.
- User-scoped data isolation.
- Multi-user interactions.
- Concurrent or repeated operations.
- Error states in UI.
- Loading states where relevant.
- Regression risks in existing behavior.

## Test quality checks

Flag tests that are:

- Only happy-path.
- Too tightly coupled to implementation details.
- Overly mocked.
- Missing realistic data setup.
- Using brittle selectors.
- Not validating actual business behavior.
- Not aligned with product rules in `docs/PRODUCT.md`.
- Not aligned with architecture in `docs/ARCHITECTURE.md`.

## Vertical-slice checks

For each reviewed feature, check whether tests cover:

- frontend behavior
- API/domain behavior
- persistence behavior
- cross-layer integration where relevant

Do not require all layers for every story if not applicable.

## Output

Return test findings only.

For each finding, include:

- Severity:
- File/location:
- Issue:
- Missing scenario:
- Why it matters:
- Recommended fix:

Do not write tests unless explicitly asked.
