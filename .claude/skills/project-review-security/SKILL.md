---
name: project-review-security
description: Review security risks in the habits app, especially input validation, unauthenticated multi-user data isolation, API abuse, XSS, SQL safety, and sensitive data exposure.
user-invocable: false
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
---

# Project security review

Use this skill to review security risks in the habits app.

## Required context

Read first:

- `docs/PRODUCT.md`
- `docs/ARCHITECTURE.md`

Remember:

- The app is unauthenticated.
- Multiple users can exist.
- User-scoped data isolation is critical.
- Backend uses Node.js and Drizzle ORM.
- Frontend uses React and TypeScript.

## Security checks

Review for:

- Missing input validation.
- Missing backend validation when frontend validation exists.
- User A accessing or modifying user B data.
- Unsafe assumptions in the unauthenticated multi-user model.
- API endpoints without abuse controls where relevant.
- Sensitive data exposed in API responses, logs, errors, or client state.
- XSS risks, including unsafe HTML rendering.
- SQL injection risks, especially raw SQL or unsafe interpolation.
- Unsafe file, URL, date, or ID handling.
- Overly detailed error messages.
- Insecure environment variable usage.
- Dependency or package risks if visible from project files.
- Missing authorization-like checks even without formal auth.

## Drizzle-specific checks

- Prefer query builder and parameterized queries.
- Flag raw SQL unless clearly safe.
- Check user/resource scoping in `where` clauses.
- Check joins do not leak cross-user data.
- Check mutations include ownership or scope constraints.

## React-specific checks

- Flag `dangerouslySetInnerHTML`.
- Check untrusted data rendering.
- Check unsafe URL generation.
- Check client-only assumptions that should be enforced server-side.

## Output

Return security findings only.

For each finding, include:

- Severity:
- File/location:
- Issue:
- Why it matters:
- Recommended fix:

Do not fix code unless explicitly asked.
