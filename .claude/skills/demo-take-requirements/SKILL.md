---
name: demo-take-requirements
description: Capture requirements for a new feature before implementation planning. Read ./docs/PRODUCT.md and ./docs/ARCHITECTURE.md, ask critical clarifying questions, and write or update .workflow/requisites/<feature-slug>.md.
argument-hint: "<feature name or slug>"
arguments: feature_slug
disable-model-invocation: true
allowed-tools: Read Write Edit Glob Grep Bash
---

# Demo take requirements

Use the full `$ARGUMENTS` value as the feature input.

Derive `feature_slug` from the full input:

- trim whitespace
- lowercase
- replace spaces and underscores with hyphens
- remove characters that are not letters, numbers, or hyphens
- collapse repeated hyphens
- remove leading/trailing hyphens

Examples:

- `add habits for users` → `add-habits-for-users`
- `Add Habits For Users` → `add-habits-for-users`
- `add-habits-for-users` → `add-habits-for-users`

Use the slug to create or update:

`.workflow/requisites/<feature_slug>.md`

## Rules

- Read `./docs/PRODUCT.md` and `./docs/ARCHITECTURE.md` first.
- Do not create an implementation plan.
- Do not modify production code.
- Ask only questions that block correct requirements.
- Ask questions iteratively until the critical unknowns are resolved.
- If non-critical questions remain, keep them in `## Open questions`.
- When an open question is answered, remove it from `## Open questions` and incorporate the answer into the right section.
- Never invent product, business, or architecture context.

## Output structure

Write the document with these sections:

```md
# Requirements: <feature name>

## Summary

## Problem

## Goals

## Non-goals

## Users and stakeholders

## Functional requirements

Use IDs: FR-001, FR-002...

## Business rules

Use IDs: BR-001, BR-002...

## Data requirements

## UX requirements

## Technical and architectural constraints

Derived from PRODUCT.md and ARCHITECTURE.md.

## Non-functional requirements

Security, privacy, performance, reliability, accessibility, observability, compliance.

## Dependencies

## Risks and edge cases

## Assumptions

Use IDs: ASM-001, ASM-002...

## Open questions

Use IDs: OQ-001, OQ-002...

## Acceptance criteria

Use Given/When/Then when useful.

## Readiness

One of:

- Ready
- Ready with assumptions
- Not ready
```
