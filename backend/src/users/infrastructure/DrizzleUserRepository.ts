import { eq, ne, asc } from 'drizzle-orm';
import { db } from '../../shared/infrastructure/db/index.js';
import { users, type DbUser } from '../../shared/infrastructure/db/schema.js';
import type { User } from '../domain/User.js';
import { resolveIsDefault, pickNextDefaultAfter } from '../domain/User.js';
import { UserNotFoundError, OnlyUserError } from '../domain/errors.js';
import type { UserRepository } from '../domain/UserRepository.js';

export interface HabitDefinitionSeedPort {
  seedFor(userId: number): void;
}

function toUser(row: DbUser): User {
  return {
    id: row.id,
    name: row.name,
    isDefault: row.isDefault,
    createdAt: row.createdAt,
  };
}

export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly seedPort?: HabitDefinitionSeedPort) {}

  list(): User[] {
    return db.select().from(users).orderBy(asc(users.id)).all().map(toUser);
  }

  findById(id: number): User | undefined {
    const row = db.select().from(users).where(eq(users.id, id)).get();
    return row ? toUser(row) : undefined;
  }

  create(name: string): User {
    const inserted = db.transaction((tx) => {
      const existing = tx.select().from(users).all();
      const isDefault = resolveIsDefault(existing.length);
      return tx.insert(users).values({ name, isDefault }).returning().get();
    });

    if (process.env.NODE_ENV !== 'test' && this.seedPort) {
      this.seedPort.seedFor(inserted.id);
    }

    return toUser(inserted);
  }

  update(id: number, patch: { name?: string; isDefault?: boolean }): User {
    return db.transaction((tx) => {
      const existing = tx.select().from(users).where(eq(users.id, id)).get();
      if (!existing) throw new UserNotFoundError(id);

      if (patch.isDefault === true) {
        tx.update(users).set({ isDefault: false }).where(ne(users.id, id)).run();
      }

      const updates: Partial<DbUser> = {};
      if (patch.name !== undefined) updates.name = patch.name;
      if (patch.isDefault !== undefined) updates.isDefault = patch.isDefault;

      if (Object.keys(updates).length === 0) {
        return toUser(existing);
      }

      return toUser(
        tx.update(users).set(updates).where(eq(users.id, id)).returning().get(),
      );
    });
  }

  delete(id: number): void {
    db.transaction((tx) => {
      const existing = tx.select().from(users).where(eq(users.id, id)).get();
      if (!existing) throw new UserNotFoundError(id);

      const all = tx.select().from(users).all();
      if (all.length <= 1) throw new OnlyUserError();

      tx.delete(users).where(eq(users.id, id)).run();

      const remaining = tx.select().from(users).orderBy(asc(users.id)).all().map(toUser);
      const nextDefault = pickNextDefaultAfter(existing.isDefault, remaining);
      if (nextDefault) {
        tx.update(users).set({ isDefault: true }).where(eq(users.id, nextDefault.id)).run();
      }
    });
  }
}
