import { inArray, sql } from 'drizzle-orm';
import { db } from './index.js';
import { dataVersions } from './schema.js';

// The transaction handle Drizzle hands to a `db.transaction` callback. Same
// alias the repository adapters declare locally; defined here so a bump can be
// typed without every caller re-deriving it.
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Writes that every device sees regardless of which User it is looking at:
// the User list itself and the instance-wide app settings.
export const GLOBAL_SCOPE = 'global';

// Writes confined to one User's data: their Habit Definitions and Entries.
// Scoping these keeps one user's logging from invalidating another's caches
// on a shared instance.
export const userScope = (userId: number) => `user:${userId}`;

// Bump a scope's counter. MUST be called inside the same transaction as the
// write it describes (the "infrastructure owns transactions" rule is what makes
// that possible) — a bump that lands outside the transaction can be observed
// without the change it announces, or survive a rollback and advertise a change
// that never happened. Upsert rather than update: the row is created lazily on
// the first write to a scope, so no seeding or migration backfill is needed.
export function bumpDataVersion(tx: Tx, scope: string): void {
  tx.insert(dataVersions)
    .values({ scope, version: 1 })
    .onConflictDoUpdate({
      target: dataVersions.scope,
      set: { version: sql`${dataVersions.version} + 1` },
    })
    .run();
}

// The token a client compares against the one it last saw. Opaque on purpose:
// clients must treat it as "equal or not equal", never parse or order it, so
// the composition can change without a client change. A scope that has never
// been written reads as 0, which is why a fresh instance is consistent rather
// than undefined.
export function readDataVersion(userId: number): string {
  const rows = db
    .select()
    .from(dataVersions)
    .where(inArray(dataVersions.scope, [GLOBAL_SCOPE, userScope(userId)]))
    .all();
  const byScope = new Map(rows.map((r) => [r.scope, r.version]));
  return `${byScope.get(GLOBAL_SCOPE) ?? 0}.${byScope.get(userScope(userId)) ?? 0}`;
}
