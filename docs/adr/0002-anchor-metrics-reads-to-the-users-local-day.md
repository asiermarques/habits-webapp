---
title: Anchor metrics reads to the User's local day, and keep that anchor out of the offline cache key
status: Accepted
date: 2026-08-04
tags: [frontend, api, offline-sync]
---

# 0002. Anchor metrics reads to the User's local day, and keep that anchor out of the offline cache key

## Context and problem statement

Every metrics read is windowed against a calendar day: the current **Week**, the rolling **Month**, the **Year View**, the **Heatmap Range**. The backend has always accepted an optional `today` parameter on all five endpoints (`backend/src/metrics/http/schemas.ts`), falling back to `isoToday()` on the server when absent — and the frontend never sent it. Two consequences followed:

1. **The window was computed in the server's time zone.** An **Entry** is logged against the **User**'s *local* calendar day on purpose (`frontend/src/entries/date.ts`: "a habit logged at 11:55 PM belongs to that day from the user's perspective"). Metrics windowed by the server's day disagree with that for any **User** whose offset differs — an evening **Entry** can fall outside "this **Week**".
2. **The TanStack Query keys carried no day**, so a session left open across midnight kept serving the previous day's window as current, indefinitely.

Both were latent. Raising `staleTime` to 30 minutes in [ADR 0001](./0001-data-version-token-for-cross-device-convergence.md) made the second one materially more visible, which is what forced the fix now: a change that only invalidates on real data change will never, on its own, notice that the *calendar* moved.

## Decision drivers

- **Maintainability / correctness** — the day anchor is part of the identity of a cached metrics value. Leaving it implicit means the cache key lies about what it holds.
- **Consistency with the ubiquitous language** — **Week**, **Month**, **Year View** and **Heatmap Range** are all defined relative to "today"; that must be the same "today" **Entries** are logged against.
- **Offline-first** — the app must keep serving previously-viewed reads when the network is down (`docs/PRODUCT.md`, offline PWA). Any change to request shape must not silently break that.

## Considered options

1. **Send `today` and include it in the query key** — correct per-**User** windowing, day-accurate cache identity.
2. **Include `today` in the query key only, keep it out of the URL** — fixes the midnight roll-over, leaves the server computing the window in its own time zone.
3. **Leave it as-is and shorten `staleTime`** — mask the roll-over with periodic refetching.

## Decision outcome

Chosen option: **"Send `today` and include it in the query key"**, plus a Workbox `cacheKeyWillBeUsed` plugin that strips `today` from the service-worker cache key.

Option 3 is what ADR 0001 explicitly moved away from, and it fixes neither the time-zone problem nor the underlying "the key doesn't identify the value" issue. Option 2 is half a fix and leaves the two halves of the app disagreeing about what day it is.

Option 1 has one real cost that had to be paid explicitly. Putting `today` in the URL fragments the runtime API cache, which is keyed by full URL (`frontend/vite.config.ts`, `habits-api-cache`): the first launch of a new day requests a URL that was never cached, so an offline read would find nothing where yesterday's copy sits — a regression against a load-bearing product promise. The `cacheKeyWillBeUsed` plugin resolves it by normalising `today` out of the **cache key** while the network request still carries it. One cache entry per query survives across midnight, holding whatever the last successful fetch returned; a day-old window is exactly what an offline fallback is meant to be.

That plugin is serialised into `sw.js` by `workbox-build`, so it must stay self-contained and close over nothing — verified against the generated `dist/sw.js`.

### Consequences

- **Good:** metrics windows agree with how **Entries** are dated, for every **User** regardless of the server's time zone.
- **Good:** a session open across midnight rolls to the new day's window, because the day is part of the query key.
- **Good:** offline reads survive the midnight boundary rather than falling off a cliff.
- **Trade-offs:** the day is read at render time, so a component mounted and never re-rendered across midnight still holds the old key until something re-renders. Acceptable: strictly better than the previous behaviour, and no timer was worth adding for it.
- **Trade-offs:** a Workbox plugin is a piece of caching subtlety that must not be dropped when the service-worker config is next edited. It is commented at the call site and in `docs/ARCHITECTURE.md`.
- **Follow-ups:** none. The `today` parameter was already validated and supported on all five endpoints; no backend change was required.

## Links

- [`0001-data-version-token-for-cross-device-convergence.md`](./0001-data-version-token-for-cross-device-convergence.md) — the long `staleTime` that made this latent bug worth fixing now.
