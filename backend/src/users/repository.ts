import { eq, ne, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, type DbUser } from '../db/schema.js';
import type { User } from '@habitsapp/shared';

function toUser(row: DbUser): User {
  return {
    id: row.id,
    name: row.name,
    isDefault: row.isDefault,
    createdAt: row.createdAt,
  };
}

export function listUsers(): User[] {
  return db.select().from(users).orderBy(asc(users.id)).all().map(toUser);
}

export function getUser(id: number): User | undefined {
  const row = db.select().from(users).where(eq(users.id, id)).get();
  return row ? toUser(row) : undefined;
}

export function createUser(name: string): User {
  return db.transaction((tx) => {
    const existing = tx.select().from(users).all();
    const isFirstUser = existing.length === 0;

    const inserted = tx
      .insert(users)
      .values({ name, isDefault: isFirstUser })
      .returning()
      .get();

    return toUser(inserted);
  });
}

export function updateUser(id: number, patch: { name?: string; isDefault?: boolean }): User | undefined {
  return db.transaction((tx) => {
    const existing = tx.select().from(users).where(eq(users.id, id)).get();
    if (!existing) return undefined;

    if (patch.isDefault === true) {
      tx.update(users).set({ isDefault: false }).where(ne(users.id, id)).run();
    }

    const updates: Partial<DbUser> = {};
    if (patch.name !== undefined) updates.name = patch.name;
    if (patch.isDefault !== undefined) updates.isDefault = patch.isDefault;

    if (Object.keys(updates).length === 0) {
      return toUser(existing);
    }

    const updated = tx.update(users).set(updates).where(eq(users.id, id)).returning().get();
    return toUser(updated);
  });
}

export type DeleteUserResult = 'ok' | 'not_found' | 'only_user';

export function deleteUser(id: number): DeleteUserResult {
  return db.transaction((tx) => {
    const existing = tx.select().from(users).where(eq(users.id, id)).get();
    if (!existing) return 'not_found';

    const total = tx.select().from(users).all().length;
    if (total <= 1) return 'only_user';

    tx.delete(users).where(eq(users.id, id)).run();

    if (existing.isDefault) {
      const next = tx.select().from(users).orderBy(asc(users.id)).get();
      if (next) {
        tx.update(users).set({ isDefault: true }).where(eq(users.id, next.id)).run();
      }
    }

    return 'ok';
  });
}
