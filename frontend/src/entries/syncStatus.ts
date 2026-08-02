// Tracks whether the drain is succeeding, failing, or somewhere in between —
// separate from the pending-count store (offlineStore.ts) so the header can
// distinguish "changes are waiting" from "changes are stuck" (US-007).
//
// A single retryable failure doesn't flip this to failing: a transient blip
// (one 500, one dropped connection) must resolve on the next tick without the
// user ever seeing a problem state (requisites UX rule + US-007 AC). Only a
// run of consecutive failures crosses the threshold.
const FAILURE_THRESHOLD = 3;

let failureStreak = 0;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function subscribeSyncStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function recordDrainSuccess(): void {
  if (failureStreak === 0) return;
  failureStreak = 0;
  notify();
}

export function recordDrainFailure(): void {
  failureStreak += 1;
  notify();
}

export function isSyncFailing(): boolean {
  return failureStreak >= FAILURE_THRESHOLD;
}
