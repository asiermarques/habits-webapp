import { lt } from 'drizzle-orm';
import { db } from '../../shared/db/index.js';
import { appliedIdempotencyKeys } from '../../shared/db/schema.js';

// 002-entry-sync-protocol US-002 (resolves OQ-001): the dedupe store can't
// grow forever, but a key must outlive any Pending change that could still
// be sitting in a device's queue — sized against a phone offline for a long
// trip, not the 30s drain interval. 30 days is deliberately generous:
// storage is cheap, and a window that's too short would silently reinstate
// GRISK-001 with no error and no detection surface (RISK-002).
export const IDEMPOTENCY_KEY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6 hours

// `createdAt` is stored in SQLite's own CURRENT_TIMESTAMP shape
// ("YYYY-MM-DD HH:MM:SS", UTC, no fractional seconds) — the cutoff must match
// that shape exactly, or lexicographic comparison against an ISO string
// (which uses "T" and milliseconds) silently misorders.
function sqliteTimestamp(date: Date): string {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

export function deleteExpiredIdempotencyKeys(
  retentionMs: number = IDEMPOTENCY_KEY_RETENTION_MS,
  now: Date = new Date(),
): number {
  const cutoff = sqliteTimestamp(new Date(now.getTime() - retentionMs));
  const result = db.delete(appliedIdempotencyKeys).where(lt(appliedIdempotencyKeys.createdAt, cutoff)).run();
  return result.changes;
}

// Fail-quiet like telemetry and the instance gate (ARCHITECTURE.md
// `readTelemetryConfig`): inert under `NODE_ENV=test` so the suite stays
// hermetic, and a thrown cleanup run is logged rather than left to kill the
// timer — the next tick tries again instead of the store growing unbounded
// with no visible symptom.
export function startIdempotencyKeyCleanup(): void {
  if (process.env.NODE_ENV === 'test') return;

  setInterval(() => {
    try {
      deleteExpiredIdempotencyKeys();
    } catch (err) {
      console.error('[idempotency-key-cleanup] cleanup run failed', err);
    }
  }, CLEANUP_INTERVAL_MS).unref();
}
