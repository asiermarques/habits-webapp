---
title: Converge cross-device reads with a data-version token instead of time-based refetching
status: Accepted
date: 2026-08-04
tags: [scalability, api, frontend, offline-sync]
---

# 0001. Converge cross-device reads with a data-version token instead of time-based refetching

## Context and problem statement

The client's read policy was a single global `staleTime: 30s` with `refetchOnWindowFocus: false` in `frontend/src/main.tsx`. A cold load of Home issued seven requests (`/auth/status`, `/users`, `/settings`, `/habit-definitions`, `/metrics/by-habit`, `/metrics/weekly`, `/entries`), and every navigation between pages past the 30s window revalidated most of them again — including `useEntriesInfinite`, where one invalidation replays *every* page already loaded.

The policy was simultaneously too eager and too lazy. Too eager, because local writes already invalidate their own keys in `onSuccess`, so almost every timed refetch returned data the client already had. Too lazy, because with `refetchOnWindowFocus: false` nothing but a component remount could refresh anything: an installed PWA remounts nothing and reconnects nothing when it returns from the background, so a **Habit Definition** created in a desktop browser stayed invisible on the phone until a full reload — which a standalone PWA rarely gets.

Raising `staleTime` made the second problem worse; lowering it made the first worse. The question this ADR answers is: **what tells a client that something actually changed, without asking it to guess on a timer?**

This is the multi-device read counterpart to the write-side work in `.workflow/requisites/002-entry-sync-protocol.md`. That protocol makes a **Pending change** reach the backend exactly once; this decision makes a change that reached the backend *from somewhere else* reach this device.

## Decision drivers

- **Scalability** — the dominant cost is refetching unchanged data. The metrics read model recomputes on every request (`backend/src/metrics/queries/`); `/entries` refetches N pages per invalidation. Both should run only when something changed.
- **Scalability / correctness under multi-device** — the instance is explicitly multi-device (`.workflow/requisites/003-device-sync-authentication.md`), so "the client is the only writer" is false and cannot be assumed away.
- **Cost-effectiveness** — a single-instance SQLite app (`docs/ARCHITECTURE.md` § Stack). Any mechanism must be cheap to read and must not add infrastructure (no WebSocket server, no push broker, no polling of expensive endpoints).
- **Maintainability** — the correctness of "did anything change?" must live in one place, not be re-derived per resource as a hand-tuned freshness constant.

## Considered options

1. **Per-resource `staleTime` tuning** — keep timed refetching, pick a freshness window per resource (`Infinity` for **Settings** and **Users**, minutes for **Entries** and metrics).
2. **`refetchOnWindowFocus` with a moderate `staleTime`** — revalidate everything stale whenever the app returns to the foreground.
3. **A data-version token** — one cheap endpoint reporting an opaque change counter; the client invalidates only when it moves.
4. **Server push (SSE / WebSocket)** — the backend notifies connected clients of changes.
5. **HTTP conditional requests (`ETag` / `If-None-Match`) on the existing reads** — keep the request count, shrink the responses to `304`.

## Decision outcome

Chosen option: **"A data-version token"**, with `staleTime: 30 min` and `refetchOnWindowFocus: true` demoted to a backstop.

Option 1 was implemented first and rejected in use: it is guesswork about how often data changes, it must be re-tuned per resource forever, and `Infinity` on **Users** / **Settings** / **Habit Definitions** reintroduced the exact stranding problem above — the phone only converged on a reload. Option 2 alone bounds the lag but pays for it by refetching everything stale on every foreground, whether or not anything changed; it is kept only as a fallback for when option 3 fails silently. Option 4 buys near-instant convergence at the cost of a stateful connection per client, which contradicts the zero-ops single-instance posture. Option 5 shrinks payloads but keeps the request count and, unless the `ETag` is derived from something cheaper than the response, still recomputes the metrics read model to answer `304` — it composes well with this decision later, and does not replace it.

The token wins because it collapses "has anything changed?" into **one small request that usually answers no**, and it is the only option that makes a long `staleTime` safe rather than dangerous.

### Design

- **`data_versions`** (`scope` PK, `version` INTEGER) — a counter per scope. `global` covers the **User** list and **Settings**; `user:<id>` covers that **User**'s **Habit Definitions** and **Entries**.
- **The bump runs inside the same transaction as the write it describes**, in the Drizzle adapters. This is exactly what the "infrastructure owns transactions" rule (`docs/ARCHITECTURE.md` § Slice rules) buys: a bump outside the transaction could be observed without the change it announces, or survive a rollback and advertise one that never happened. `DrizzleSettingsRepository.upsert` gained a transaction solely for this.
- **A counter, not a timestamp.** `max(created_at)` over the data tables would miss both an edited **Entry** (its `created_at` is unchanged) and a deleted one (nothing is left to read). Both cases are covered by tests in `backend/src/sync/__tests__/sync.test.ts`.
- **Paths that apply nothing do not bump** — an **Idempotency Key** replay, a no-op `PUT`. Without this, an offline drain retrying its backlog would make every device refetch for no reason.
- **`GET /api/sync/version?userId=`** returns `{ version }` — two indexed primary-key lookups, no scan. The token is **opaque**: clients compare for equality and never parse it, so its composition can change without a client change.
- **`DataVersionSync`** (`frontend/src/sync/`, mounted once in `App.tsx`) is the mirror of `EntrySync`: that one pushes local changes out, this one pulls remote ones in. It checks on mount, on `visibilitychange` to visible, on `online`, and on a 60s interval **only while the document is visible**.
- **The first check for a **User** records a baseline and invalidates nothing** — otherwise every cold start would refetch data the app had just loaded.
- **It uses `apiFetch` directly, not a `useQuery`** — the same reason `drainPendingEntries` does. It is a background signal, never rendered, whose failures must stay silent; a `useQuery` would route every offline foreground through the global `QueryCache.onError` toast.

### Consequences

- **Good:** unchanged data is never refetched. Returning to the app costs one small request that usually answers "nothing changed"; only a real change triggers the five invalidations.
- **Good:** per-resource freshness tuning disappears. One long `staleTime` in `main.tsx`, with the gate's `Infinity` as the only override (it changes solely via login/logout or a 401, each of which already invalidates its key).
- **Good:** the `user:<id>` scope means one person logging on a shared instance does not make everyone else's devices refetch.
- **Trade-offs:** every write path must remember to bump. The blast radius of forgetting is silent staleness on other devices, which no test of that write itself would catch — this is the main maintenance hazard, and the reason the 30-minute `staleTime` backstop exists rather than `Infinity`.
- **Trade-offs:** convergence is not instant. Worst case is one poll interval (60s) in the foreground, or the next foreground transition.
- **Trade-offs:** a new table and a new endpoint for something users never see.
- **Follow-ups:** `/api/sync/version` sits behind the Instance Gate and trusts `userId` verbatim, exactly like every other `/api/*` endpoint (`docs/ARCHITECTURE.md` § `userId` trust boundary). It inherits whatever `003-device-sync-authentication` introduces; it adds no new exposure, since anyone past the gate can already read the data itself.
- **Follow-ups:** the token is the natural `ETag` source for option 5 — it would let the metrics endpoints answer `304` **without** recomputing the read model. Not done here.
- **Follow-ups:** `invalidateQueries(['entries'])` still replays every loaded page of the infinite query. That now only happens on a real change, but a `maxPages` cap or a `setQueryData` patch would bound it further.

## Links

- `.workflow/requisites/002-entry-sync-protocol.md` — the write-side counterpart (exactly-once push of a **Pending change**).
- `.workflow/requisites/003-device-sync-authentication.md` — will authenticate this endpoint along with the rest of `/api/*`.
- [`0002-anchor-metrics-reads-to-the-users-local-day.md`](./0002-anchor-metrics-reads-to-the-users-local-day.md) — the correctness fix a long `staleTime` made necessary.
