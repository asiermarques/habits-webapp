---
name: demo-create-implementation-plan
description: Create a production-deliverable vertical-slice implementation plan from .workflow/requisites/<feature-slug>.md. The plan is an index, and each user story is written to .workflow/tasks/<feature-slug>/US-XXX.md.
argument-hint: "<feature name or slug>"
arguments:
  - feature_slug
disable-model-invocation: true
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
---

# Demo create implementation plan

Use the full `$ARGUMENTS` value as the feature input.

Derive `feature_slug` from the full input using kebab-case.

Examples:

- `add habits for users` → `add-habits-for-users`
- `add-habits-for-users.md` → `add-habits-for-users`

Then use:

- Requirements: `.workflow/requisites/<feature_slug>.md`
- Plan: `.workflow/implementation-plans/<feature_slug>.md`
- Tasks: `.workflow/tasks/<feature_slug>/US-XXX.md`

Create or update:

`.workflow/implementation-plans/$feature_slug.md`

Also create or update task files in:

`.workflow/tasks/$feature_slug/US-XXX.md`

Mandatory sources:

- `.workflow/requisites/$feature_slug.md`
- `./docs/PRODUCT.md`
- `./docs/ARCHITECTURE.md`

## Rules

- Read `./docs/PRODUCT.md` before planning.
- Read `./docs/ARCHITECTURE.md` before planning.
- Read `.workflow/requisites/$feature_slug.md` before planning.
- Do not implement code.
- Do not modify production files.
- Do not invent unresolved requirements.
- If any mandatory source is missing, stop.
- If requirements are `Not ready`, ask only the critical questions needed before planning.
- If answers change requirements, update `.workflow/requisites/$feature_slug.md` first.
- Plan by vertical slices, not by technical layers.
- Each vertical slice is an epic.
- Each user story must be independently deliverable to production.
- The implementation plan must stay concise.
- Do not put full task details in the implementation plan.
- Put full user story details in separate files under `.workflow/tasks/$feature_slug/`.
- Do not create separate frontend, backend, infrastructure, or observability task groups.
- Do not create a separate testing section.
- Testing is implicit in each user story and will be handled by the implementation skill.
- Keep task IDs stable when updating an existing plan.
- Do not renumber existing tasks unless explicitly needed.
- Preserve existing task status when updating, unless the user asks to change it.

## Process

1. Read `./docs/PRODUCT.md`.
2. Read `./docs/ARCHITECTURE.md`.
3. Read `.workflow/requisites/$feature_slug.md`.
4. Check readiness, assumptions, open questions, risks, and acceptance criteria.
5. Inspect code only if needed to understand existing patterns, APIs, data flows, or constraints.
6. Split the feature into production-deliverable vertical slices.
7. Split each slice into production-deliverable user stories.
8. Write the concise implementation plan.
9. Write one task file per user story.

## Implementation plan format

Write `.workflow/implementation-plans/$feature_slug.md` using this structure:

```md
# Implementation plan: <feature name>

## Sources

- Product context: `./docs/PRODUCT.md`
- Architecture context: `./docs/ARCHITECTURE.md`
- Requirements: `.workflow/requisites/<feature-slug>.md`

## Summary

Briefly describe:

- what will be built
- how the work is split
- major constraints
- major risks

## Product and architecture alignment

Summarize how the plan aligns with:

- `./docs/PRODUCT.md`
- `./docs/ARCHITECTURE.md`

## Planning principles

- The plan is split into vertical slices.
- Each vertical slice is an epic.
- Each user story is independently deliverable to production.
- Detailed user story definitions live in `.workflow/tasks/<feature-slug>/US-XXX.md`.
- The plan is an index, not the implementation input.

## Vertical slices

### Slice 1: <slice name>

Status: <Not started | In progress | Blocked | Done>

Goal:

User/business value:

Scope:

Out of scope:

Dependencies:

#### Rollout plan

- Rollout strategy:
- Feature flag:
- Backward compatibility:
- Migration considerations:
- Monitoring during rollout:
- Rollback approach:

#### User stories

- [ ] US-001: <short title>
  - Task file: `.workflow/tasks/<feature-slug>/US-001.md`
  - Production deliverable: <one concise sentence>
  - Status: <Not started | In progress | Blocked | Done>

- [ ] US-002: <short title>
  - Task file: `.workflow/tasks/<feature-slug>/US-002.md`
  - Production deliverable: <one concise sentence>
  - Status: <Not started | In progress | Blocked | Done>

#### Risks

- RISK-001: ...

#### Open questions

- OQ-001: ...

---

### Slice 2: <slice name>

Repeat the same structure.

## Cross-slice dependencies

List dependencies between slices.

## Global risks

- RISK-001: ...

## Global open questions

- OQ-001: ...

## Implementation readiness

One of:

- Ready
- Ready with assumptions
- Not ready

Explain why.
```

## User story task file format

For each user story, create:

`.workflow/tasks/$feature_slug/US-XXX.md`

Use this structure:

````md
# US-XXX: <short title>

Status: <Not started | In progress | Blocked | Done>

Feature: `<feature-slug>`

Slice: `<slice name>`

Plan: `.workflow/implementation-plans/<feature-slug>.md`

Requirements: `.workflow/requisites/<feature-slug>.md`

Sources:

- Product context: `./docs/PRODUCT.md`
- Architecture context: `./docs/ARCHITECTURE.md`

## User story

As a <user/system/team>, I want <capability>, so that <benefit>.

## Production deliverable

Describe exactly what can be released to production after this user story is completed.

The deliverable must be independently releasable.

## Scope

Include all work needed for this story to be production-ready.

- Product behavior:
- Frontend/UI:
- Backend/API/domain:
- Data/persistence:
- Infrastructure/configuration:
- Observability:
- Security/privacy/compliance:
- Rollout:

Use `Not applicable` where a category does not apply.

## Out of scope

List what this story explicitly does not include.

## Dependencies

List dependencies on:

- other user stories
- external systems
- product decisions
- architectural constraints
- configuration
- data availability

## Acceptance criteria

Use BDD.

```gherkin
Given ...
When ...
Then ...
```
````

Add more scenarios when needed.

## Rollout notes

Describe only rollout considerations specific to this user story.

## Risks

- RISK-001: ...

## Open questions

- OQ-001: ...

## Implementation notes

Add only constraints or context needed by the implementation skill.

Do not write code.
Do not define detailed test cases.
Do not create an implementation checklist.

```

## Quality checklist

Before finishing, verify that:

- `.workflow/implementation-plans/$feature_slug.md` exists.
- `.workflow/tasks/$feature_slug/` exists.
- Each user story in the plan has a matching `US-XXX.md` file.
- Each `US-XXX.md` file is referenced from the implementation plan.
- The plan references `./docs/PRODUCT.md`.
- The plan references `./docs/ARCHITECTURE.md`.
- The plan references `.workflow/requisites/$feature_slug.md`.
- The plan is split into vertical slices.
- Each vertical slice is an epic.
- Each user story is independently deliverable to production.
- Task details are not duplicated in the implementation plan.
- No tasks are grouped by frontend, backend, infrastructure, or observability.
- Each task file includes BDD acceptance criteria.
- There is no separate testing section.
- Rollout is defined per slice.
- Open questions are explicit.
- Risks are explicit.
- Final readiness status is clear.

## Final response

Return only:

- plan path
- task directory path
- source requirements path
- product source path: `./docs/PRODUCT.md`
- architecture source path: `./docs/ARCHITECTURE.md`
- number of vertical slices
- number of user stories
- readiness
- unresolved open questions count
- critical blockers, if any
```
