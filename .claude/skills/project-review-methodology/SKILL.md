---
name: project-review-methodology
description: Apply the standard project review methodology for the habits app. Use when reviewing code quality, performance, product alignment, security, tests, and documentation before producing a prioritized review report.
user-invocable: false
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
---

# Project review methodology

Use this skill to perform a structured review of recently written or modified code.

## Required context

Read first:

- `docs/PRODUCT.md`
- `docs/ARCHITECTURE.md`

Use them as source of truth for product intent, architecture, conventions, and constraints.

## Process

1. Identify the review scope.
   - Prefer recently modified files.
   - If unclear, inspect the relevant feature or full project area.
2. Review across all dimensions:
   - code quality
   - testing gaps
   - performance
   - product/business alignment
   - security
   - documentation accuracy
3. Cross-check implementation against:
   - `docs/PRODUCT.md`
   - `docs/ARCHITECTURE.md`
   - existing code conventions
4. Use specialized review skills when useful:
   - `project-security-review`
   - `project-test-review`
   - `project-docs-consistency-review`
5. Classify findings by severity.
6. Return actionable findings to the calling agent.

## Severity

- Critical: security issue, data corruption, broken core flow, major product contradiction.
- High: significant bug, missing error handling, large test gap, serious performance issue.
- Medium: maintainability issue, moderate test gap, minor behavior mismatch, partial documentation drift.
- Low: naming, small cleanup, minor documentation or style improvement.

## Finding format

For each finding, include:

- Severity:
- File/location:
- Issue:
- Why it matters:
- Recommended fix:

Be specific. Avoid vague advice.

## Checklist

Before finishing, verify:

- All review dimensions were considered.
- Product and architecture docs were read.
- Findings are prioritized by impact.
- Recommendations are actionable.
- Intentional product decisions were not flagged as bugs.
