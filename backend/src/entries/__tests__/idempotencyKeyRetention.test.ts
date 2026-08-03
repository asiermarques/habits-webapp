import { describe, it, expect } from 'vitest';
import { db } from '../../shared/db/index.js';
import { appliedIdempotencyKeys } from '../../shared/db/schema.js';
import {
  deleteExpiredIdempotencyKeys,
  IDEMPOTENCY_KEY_RETENTION_MS,
} from '../infrastructure/idempotencyKeyRetention.js';

function isoAt(msAgo: number): string {
  return new Date(Date.now() - msAgo).toISOString().slice(0, 19).replace('T', ' ');
}

describe('Idempotency Key retention (US-002)', () => {
  it('removes a recorded key older than the retention window', () => {
    db.insert(appliedIdempotencyKeys)
      .values({
        key: 'stale-key',
        entryId: 1,
        responseBody: null,
        createdAt: isoAt(IDEMPOTENCY_KEY_RETENTION_MS + 60_000),
      })
      .run();

    const deleted = deleteExpiredIdempotencyKeys();

    expect(deleted).toBe(1);
    expect(db.select().from(appliedIdempotencyKeys).all()).toEqual([]);
  });

  it('keeps a recorded key inside the retention window, still recognised for dedupe', () => {
    db.insert(appliedIdempotencyKeys)
      .values({
        key: 'fresh-key',
        entryId: 2,
        responseBody: JSON.stringify({ id: 2 }),
        createdAt: isoAt(60_000),
      })
      .run();

    const deleted = deleteExpiredIdempotencyKeys();

    expect(deleted).toBe(0);
    const remaining = db.select().from(appliedIdempotencyKeys).all();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].key).toBe('fresh-key');
  });

  it('leaves the store bounded across many cleanup runs without disturbing dedupe of in-window keys', () => {
    db.insert(appliedIdempotencyKeys)
      .values([
        { key: 'old-1', entryId: 1, responseBody: null, createdAt: isoAt(IDEMPOTENCY_KEY_RETENTION_MS + 1000) },
        { key: 'old-2', entryId: 2, responseBody: null, createdAt: isoAt(IDEMPOTENCY_KEY_RETENTION_MS + 2000) },
        { key: 'recent', entryId: 3, responseBody: null, createdAt: isoAt(1000) },
      ])
      .run();

    deleteExpiredIdempotencyKeys();
    deleteExpiredIdempotencyKeys();
    deleteExpiredIdempotencyKeys();

    const remaining = db.select().from(appliedIdempotencyKeys).all();
    expect(remaining.map((r) => r.key)).toEqual(['recent']);
  });
});
