# Ubiquitous Language

Canonical vocabulary for the habits app. Bootstrapped from `PRODUCT.md` and `ARCHITECTURE.md`.

## People

| Term             | Definition                                                                                | Aliases to avoid          |
| ---------------- | ----------------------------------------------------------------------------------------- | ------------------------- |
| **User**         | A named profile on the instance; not authenticated, just an identity to scope data to.    | Account, profile, login   |
| **Active User**  | The single **User** currently selected on the client; persisted in `localStorage`.        | Current user, logged-in user |
| **Default User** | The **User** auto-selected for new sessions; exactly one exists at any time.              | Primary user              |

## Habits

| Term                 | Definition                                                                                                       | Aliases to avoid                    |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| **Habit Definition** | A per-**User** catalogue item describing a habit to track (name, archetype, positive flag, color).               | Habit (when meaning the catalogue item), habit type config |
| **Archetype**        | The kind of **Habit Definition**: `workout`, `writing`, or `custom`. Determines which **Entry Data** shape applies. | Habit type, category, kind          |
| **Positive Habit**   | A **Habit Definition** the **User** wants to do more of. Workout and Writing are always positive.                | Good habit                          |
| **Negative Habit**   | A **Habit Definition** the **User** wants to do less of. Only Custom **Habit Definitions** can be negative.      | Bad habit, vice                     |

## Logging

| Term              | Definition                                                                                                                                   | Aliases to avoid           |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| **Entry**         | A single occurrence of a **Habit Definition** logged by a **User** on a given **Date**. Multiple per `(user, definition, date)` are allowed. | Log, record, event, occurrence |
| **Entry Data**    | The archetype-specific payload attached to an **Entry**: `WorkoutData`, `WritingData`, or `CustomData`.                                      | Fields, payload            |
| **Repetitions**   | The `number` field on Workout and Custom **Entry Data**. Summed in metrics; an **Entry** without it counts as one.                           | Reps, count, times         |
| **Cost Spent**    | The `amount` field on Custom **Entry Data**, denominated in the global **Currency**. Drives the **Bad Habit Total Cost** card.               | Price, money, expense      |
| **Backfill**      | Creating an **Entry** with a **Date** earlier than today.                                                                                    | Retro log, late entry      |

## Metrics & periods

| Term                       | Definition                                                                                                            | Aliases to avoid                 |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **Week**                   | Monday-to-Sunday range. The current **Week** anchors the Home weekly chart.                                           | 7-day window                     |
| **Month**                  | Rolling 30 days ending today. Window for the Summary score cards.                                                     | 30d, calendar month              |
| **Year View**              | The last 13 **Weeks** (~3 months) shown on `/metrics`. A literal year isn't shown — name kept for product continuity. | Year, 12 months                  |
| **Heatmap Range**          | The last 26 **Weeks** (~6 months) used by the per-**Habit Definition** heatmaps.                                      | 6-month window                   |
| **Summary Card**           | A `/metrics` score card for the rolling **Month**: most-logged, least-logged, bad-habit total cost, active habits.    | KPI, stat                        |
| **Most Logged Habit**      | The **Habit Definition** with the highest summed **Repetitions** over the **Month**.                                  | Top habit                        |
| **Least Logged Habit**     | The **Habit Definition** with the lowest count over the **Month**; zero-**Entry** habits can win.                     | Bottom habit                     |
| **Bad Habit Total Cost**   | Sum of **Cost Spent** across **Entries** of **Negative Habits** over the **Month**.                                   | Vice spend                       |
| **Active Habit**           | A **Habit Definition** with at least one **Entry** in the **Month**.                                                  | Used habit                       |

## Settings

| Term         | Definition                                                                                                  | Aliases to avoid     |
| ------------ | ----------------------------------------------------------------------------------------------------------- | -------------------- |
| **Settings** | Global singleton key/value store shared across all **Users**.                                               | Config, preferences  |
| **Currency** | The ISO code (`EUR`, `USD`, `GBP`, `JPY`, `CHF`, `CAD`, `AUD`) used to render **Cost Spent**. Default `EUR`. | Money unit           |

## Relationships

- A **User** owns many **Habit Definitions**; deleting the **User** cascades.
- A **Habit Definition** has one **Archetype** and is owned by exactly one **User**.
- An **Entry** belongs to one **User** and one **Habit Definition**; cross-user references are rejected (HTTP 403).
- An **Entry** has exactly one **Entry Data** row matching its **Habit Definition**'s **Archetype**.
- A **Habit Definition** with any **Entry** cannot change **Archetype** nor be deleted (HTTP 409).
- Exactly one **User** is the **Default User**; deleting it promotes the next-oldest.
- **Currency** is global — not per-**User**.

## Example dialogue

> **Dev:** "If a **User** logs an **Entry** for a **Workout** **Habit Definition** without filling in **Repetitions**, what does the **Most Logged Habit** card count?"

> **Domain expert:** "One. The repetition-summing rule says: if `number` is set, sum it; if not, the **Entry** still counts as one occurrence."

> **Dev:** "And for a **Writing** **Habit Definition**?"

> **Domain expert:** "Always one per **Entry** — Writing has no **Repetitions** field. `words` is for the **User** to read, not for metrics."

> **Dev:** "What about **Bad Habit Total Cost** — does it include **Workout** **Entries**?"

> **Domain expert:** "No. Only **Negative Habits** contribute, and only Custom **Habit Definitions** can be negative. So it's `entry_custom_data.amount` summed where the **Habit Definition** has `positive = false`."

> **Dev:** "Last one — can two **Users** share a **Habit Definition** called 'Running'?"

> **Domain expert:** "They each have their own. **Habit Definitions** are per-**User**. The only globally-shared thing is **Currency** in **Settings**."

## Flagged ambiguities

- **"Habit"** is overloaded in code and UI: sometimes it means a **Habit Definition** (the catalogue item), sometimes an **Entry** (the occurrence). Prefer the explicit terms; reserve bare "habit" for casual UI copy only.
- **"Type"** in code (`HabitType`, `type` column) means **Archetype**. Prefer **Archetype** in domain conversation to avoid colliding with TypeScript's "type".
- **"Bad habit"** appears in UI ("Bad habit total cost"); the canonical term is **Negative Habit**. The UI string can stay since "bad" reads more naturally to end users, but specs and code should say **Negative Habit**.
- **"Number"** (the DB column) means **Repetitions** in the domain. The column name is kept for legacy reasons; never expose "number" in UI or specs.
- **"Year view"** on `/metrics` is actually 13 **Weeks** (~3 months). The name is a product-vocabulary holdover — call it **Year View** when referring to that screen section, but never imply it covers 12 months.
- **"Month"** always means a rolling 30-day window in this app, never a calendar month.
