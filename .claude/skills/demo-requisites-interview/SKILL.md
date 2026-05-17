---
name: demo-requisites-interview
description: Capture requirements for a new feature before implementation planning. Reads ./docs/PRODUCT.md, ./docs/ARCHITECTURE.md, and ./docs/UBIQUITOUS_LANGUAGE.md, surfaces conflicts with existing product decisions and domain terminology, asks closed clarifying questions (max 2 rounds), and writes .workflow/requisites/<id>-<english-feature-slug>.md. Use BEFORE planning or implementation, not for in-flight tasks.
argument-hint: "<feature request, feature name, slug, or existing requisites file>"
arguments:
  - feature_input
disable-model-invocation: true
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
---

# Demo requisites interview

Capture requirements for `$ARGUMENTS` under `.workflow/requisites/` before any planning. Optimize for a sharp problem statement, not a comprehensive design doc.

## Process (in order)

1. Read `./docs/PRODUCT.md` and `./docs/ARCHITECTURE.md`. If either is missing, stop and report. Also read `./docs/UBIQUITOUS_LANGUAGE.md` if it exists (treat absent as "no glossary yet" — don't stop).
2. Check `.workflow/requisites/` (via Glob) for an existing match — update it instead of creating new. Match by full path, file name, slug-with-ID, or slug-without-ID.
3. **Conflict scan** (mandatory): list every contradiction between `$ARGUMENTS` and PRODUCT.md / ARCHITECTURE.md (e.g. explicit non-goals, "we don't do X", architectural constraints). Conflicts go into the FIRST question round.
4. **Glossary scan** (mandatory if UBIQUITOUS_LANGUAGE.md exists): for each domain-relevant noun/verb in `$ARGUMENTS`, classify against the glossary as *matches canonical* / *synonym of canonical* / *conflicts with existing* / *new term*. Only the latter three are actionable. Apply the cheap-flag heuristic — skip generic verbs and obvious inflections; only flag terms that would survive into code, UI copy, or other specs. Actionable items go into the FIRST question round alongside conflicts (e.g. "you wrote 'log' — is this our existing **Entry**, or a new concept?").
5. **Size gate**: if the feature spans >1 vertical slice OR crosses >2 backend slices, propose a split via AskUserQuestion and stop until confirmed. Don't capture a monster doc.
6. Ask clarifying questions (see "Question rules"). Max 2 rounds.
7. Derive `requirement_id`, `feature_slug`, `requirements_path` (see "Naming").
8. Write the doc (see "Output"). Use canonical glossary terms throughout — do not introduce synonyms. Skip sections that don't apply — don't fill with "Not applicable".
9. Final response: path, status, open questions count, AND a `glossary update needed: <terms>` line if any new/conflicting terms were confirmed in step 4. The implementer should re-run `/ubiquitous-language <term-or-this-file-path>` (Challenge mode) before coding.

## Question rules

- Use `AskUserQuestion` with closed options (2–4 per question, mutually exclusive). Don't ask free-form prose questions yourself — the `AskUserQuestion` tool automatically appends an **"Other"** choice that lets the user type a custom answer, so always design the options as if "Other" exists. If the user picks Other, treat their typed reply as authoritative, even if it contradicts every option you offered, and integrate it as-is (don't re-ask the same question with rephrased options).
- Round 1: cover conflicts (from step 3) + the 1–3 questions whose answers most change the shape of the feature (scope, user, period, mechanic).
- Round 2 (optional): only if round 1 surfaced new ambiguity (including ambiguity introduced by an "Other" reply). If you still need a round 3 → status = `Not ready`, stop.
- If a missing fact would take the user 30s to answer, **ask** — don't push it into Assumptions.
- When the user's likely answer doesn't fit a tidy 2–4 option list (e.g. naming, numeric thresholds, copy text), still offer 2–3 reasonable defaults so the user can pick or override via Other — never skip the question just because options feel forced.

### Example of a well-formed question

> **Q:** Active user is selected one at a time on the client (per ARCHITECTURE.md). Should this feature be per-user or global?
> - Per-user (each user has their own) — consistent with habit definitions
> - Global (shared across all users on the instance) — consistent with currency setting

## Naming

`.workflow/requisites/<id>-<english-feature-slug>.md`

- `<id>`: next 3-digit number after existing `[0-9][0-9][0-9]-*.md` files, or `001` if none.
- `<english-feature-slug>`: kebab-case, English, **max 4 words**, noun + main verb when possible. Translate from Spanish/other languages first, then strip filler.
  - `quiero un sistema de login de usuario y contraseña` → `user-password-login`
  - `add habits for users` → `user-habit-creation`
- If `$ARGUMENTS` is too vague to slug (e.g. "make me an app"), ask a scoping question before deriving the ID.

## Rules

- Don't create plans, tasks, or code. Don't touch files outside `.workflow/requisites/`.
- Don't invent product, business, or architecture context. Cite PRODUCT.md / ARCHITECTURE.md when relevant.
- Requirements are problem-space. Move solution detail (DB schema, endpoint list) to the implementation plan — not here.
- IDs (FR-001, BR-001, etc.): only use when a section has ≥3 items. For 1–2 items, plain bullets.
- `Ready with assumptions`: only when assumptions are architectural/conventional (e.g. "follow the existing slice pattern"). If an assumption fills a gap the user could answer, status = `Not ready` and ask.
- Status options: `Ready` | `Ready with assumptions` | `Not ready`.

## Output

Write only the sections that have real content. Required: header block, Summary, Problem, Goals, Acceptance criteria, Readiness. Everything else is optional.

```md
# Requisites: <feature name>

Status: <Ready | Ready with assumptions | Not ready>
Requirement ID: <id>
Feature slug: `<slug>`
Path: `.workflow/requisites/<id>-<slug>.md`

## Original request

Verbatim or short paraphrase of `$ARGUMENTS`.

## Summary

2–4 sentences. What the feature is and how it fits the product.

## Problem

Why this is needed. User pain or business gap, not the solution.

## Goals

What success looks like. Bullets; use GOAL-001… only if ≥3 items.

## Non-goals (optional)

What's explicitly out. NOGOAL-001… if ≥3.

## Functional requirements (optional)

User-visible behaviors. FR-001… if ≥3.

## Business rules (optional)

Invariants the system must enforce. BR-001… if ≥3.

## UX requirements (optional)

Only if UX placement/affordances are decided. Don't speculate.

## Constraints (optional)

Only constraints derived from PRODUCT.md, ARCHITECTURE.md, or the conversation. Cite the source. Skip if none.

## Non-functional requirements (optional)

Include ONLY the relevant items (security, privacy, performance, accessibility, etc.). Don't enumerate all categories.

## Dependencies (optional)

Other features, tables, or docs this builds on. Skip if none.

## Risks and edge cases (optional)

RISK-001 / EDGE-001 if ≥3.

## Assumptions (optional)

ASM-001 if ≥3. Architectural-only (see Rules).

## Open questions

OQ-001 if ≥3. Write `None.` if none.

## Acceptance criteria

Given/When/Then for the main scenarios. 3–7 scenarios usually enough.

## Readiness

`Ready` | `Ready with assumptions` | `Not ready` — one sentence justifying.
```

## Final response

Return only:
- requisites path
- status
- open questions count
- any product-decision change the implementer must apply (e.g. "PRODUCT.md update needed")
- `glossary update needed: <terms>` if step 4 confirmed any new, renamed, or conflicting terms — implementer runs `/ubiquitous-language <requisites-path>` (Challenge mode) before coding
