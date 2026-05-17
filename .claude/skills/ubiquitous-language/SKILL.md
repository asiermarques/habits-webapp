---
name: ubiquitous-language
description: Extract a DDD-style ubiquitous language glossary from the current conversation, flagging ambiguities and proposing canonical terms. Also acts as a gatekeeper for new terms introduced by a single requirement or feature spec. Saves to UBIQUITOUS_LANGUAGE.md. Use when user wants to define domain terms, build a glossary, harden terminology, vet a new term against the existing glossary, or mentions "domain model" or "DDD".
argument-hint: "<optional: a new term, a phrase, or a path to a requisites file>"
disable-model-invocation: true
---

# Ubiquitous Language

Extract and formalize domain terminology into a consistent glossary saved to `./docs/UBIQUITOUS_LANGUAGE.md`, OR vet a single new term/spec against the existing glossary.

## Mode selection

Pick the mode based on `$ARGUMENTS`:

- **Sweep mode** — no argument, or argument like "build glossary", "extract terms". Scan the whole conversation. Use the **Sweep process** below.
- **Challenge mode** — argument is a specific term, phrase, or path to a `.workflow/requisites/*.md` file. Vet only the terms introduced by that input against the existing glossary. Use the **Challenge process** below.

If unsure, default to Sweep mode.

## Sweep process

1. **Scan the conversation** for domain-relevant nouns, verbs, and concepts
2. **Identify problems**:
   - Same word used for different concepts (ambiguity)
   - Different words used for the same concept (synonyms)
   - Vague or overloaded terms
3. **Propose a canonical glossary** with opinionated term choices
4. **Write to `./docs/UBIQUITOUS_LANGUAGE.md`** in the working directory using the format below
5. **Output a summary** inline in the conversation

## Challenge process

Use when a new requirement, feature spec, or single term needs to be reconciled with the existing glossary — *don't* rewrite the whole glossary.

1. **Load** `./docs/UBIQUITOUS_LANGUAGE.md`. If it doesn't exist, fall back to Sweep mode.
2. **Extract candidate terms** from `$ARGUMENTS` (if a file path, read it first). Keep only domain-relevant nouns/verbs — skip generic programming words.
3. **Classify each candidate** against the existing glossary into exactly one bucket:
   - **New** — no existing term covers this concept. Propose adding it.
   - **Synonym** — same concept as an existing canonical term. Recommend using the canonical term; add to "Aliases to avoid".
   - **Conflict** — same word as an existing term but different concept, OR existing term is now overloaded. Recommend a rename/split.
   - **Refinement** — narrows or extends an existing term. Recommend updating the existing definition.
4. **Report** the classification inline as a short table:

   | Candidate | Verdict | Canonical | Action |
   |---|---|---|---|
   | "log" | Synonym | **Entry** | Use **Entry** in the spec |
   | "streak" | New | **Streak** | Add to glossary under Metrics |

5. **Ask for confirmation** via `AskUserQuestion` before writing — one question per non-trivial verdict, with options: *adopt as proposed* / *use different term* / *skip*. Skip the question for obvious synonyms of already-canonical terms.
6. **Update `./docs/UBIQUITOUS_LANGUAGE.md`** with only the confirmed changes. Keep edits minimal — don't rewrite untouched sections. Update the example dialogue *only* if a new term materially changes how terms interact.
7. **Final response** lists: terms added, terms aliased, terms renamed/split, and any open verdicts the user deferred.

### Cheap-flag heuristic

Be a gatekeeper, not a bikeshedder. Skip the candidate silently if:
- It's a generic verb ("create", "show", "list") with no domain weight
- It's clearly an inflection of an existing canonical term ("entries" → **Entry**)
- It only appears once and isn't load-bearing in the requirement

Only flag terms that would survive into code, UI copy, or future specs.

## Output Format

Write a `./docs/UBIQUITOUS_LANGUAGE.md` file with this structure:

```md
# Ubiquitous Language

## Order lifecycle

| Term        | Definition                                              | Aliases to avoid      |
| ----------- | ------------------------------------------------------- | --------------------- |
| **Order**   | A customer's request to purchase one or more items      | Purchase, transaction |
| **Invoice** | A request for payment sent to a customer after delivery | Bill, payment request |

## People

| Term         | Definition                                  | Aliases to avoid       |
| ------------ | ------------------------------------------- | ---------------------- |
| **Customer** | A person or organization that places orders | Client, buyer, account |
| **User**     | An authentication identity in the system    | Login, account         |

## Relationships

- An **Invoice** belongs to exactly one **Customer**
- An **Order** produces one or more **Invoices**

## Example dialogue

> **Dev:** "When a **Customer** places an **Order**, do we create the **Invoice** immediately?"
> **Domain expert:** "No — an **Invoice** is only generated once a **Fulfillment** is confirmed. A single **Order** can produce multiple **Invoices** if items ship in separate **Shipments**."
> **Dev:** "So if a **Shipment** is cancelled before dispatch, no **Invoice** exists for it?"
> **Domain expert:** "Exactly. The **Invoice** lifecycle is tied to the **Fulfillment**, not the **Order**."

## Flagged ambiguities

- "account" was used to mean both **Customer** and **User** — these are distinct concepts: a **Customer** places orders, while a **User** is an authentication identity that may or may not represent a **Customer**.
```

## Rules

- **Be opinionated.** When multiple words exist for the same concept, pick the best one and list the others as aliases to avoid.
- **Flag conflicts explicitly.** If a term is used ambiguously in the conversation, call it out in the "Flagged ambiguities" section with a clear recommendation.
- **Only include terms relevant for domain experts.** Skip the names of modules or classes unless they have meaning in the domain language.
- **Keep definitions tight.** One sentence max. Define what it IS, not what it does.
- **Show relationships.** Use bold term names and express cardinality where obvious.
- **Only include domain terms.** Skip generic programming concepts (array, function, endpoint) unless they have domain-specific meaning.
- **Group terms into multiple tables** when natural clusters emerge (e.g. by subdomain, lifecycle, or actor). Each group gets its own heading and table. If all terms belong to a single cohesive domain, one table is fine — don't force groupings.
- **Write an example dialogue.** A short conversation (3-5 exchanges) between a dev and a domain expert that demonstrates how the terms interact naturally. The dialogue should clarify boundaries between related concepts and show terms being used precisely.

<example>

## Example dialogue

> **Dev:** "How do I test the **sync service** without Docker?"

> **Domain expert:** "Provide the **filesystem layer** instead of the **Docker layer**. It implements the same **Sandbox service** interface but uses a local directory as the **sandbox**."

> **Dev:** "So **sync-in** still creates a **bundle** and unpacks it?"

> **Domain expert:** "Exactly. The **sync service** doesn't know which layer it's talking to. It calls `exec` and `copyIn` — the **filesystem layer** just runs those as local shell commands."

</example>

## Re-running

When invoked again in the same conversation (Sweep mode):

1. Read the existing `./docs/UBIQUITOUS_LANGUAGE.md`
2. Incorporate any new terms from subsequent discussion
3. Update definitions if understanding has evolved
4. Re-flag any new ambiguities
5. Rewrite the example dialogue to incorporate new terms

Challenge mode is idempotent — re-running with the same input should produce no changes once verdicts are applied.
