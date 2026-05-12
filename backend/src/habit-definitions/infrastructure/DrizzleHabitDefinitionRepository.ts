import { and, asc, eq } from 'drizzle-orm';
import { db } from '../../shared/db/index.js';
import { entries, habitDefinitions, users, type DbHabitDefinition } from '../../shared/db/schema.js';
import type { HabitDefinition } from '../domain/HabitDefinition.js';
import { resolvePositive, applyPatch } from '../domain/HabitDefinition.js';
import { pickColor } from '../domain/Color.js';
import { HabitDefinitionNotFoundError, HasEntriesError, UserNotFoundError } from '../domain/errors.js';
import type { HabitDefinitionRepository, InsertInput } from '../domain/HabitDefinitionRepository.js';
import type { HabitPatch } from '../domain/HabitDefinition.js';
import type { EntryRepository } from '../../entries/domain/EntryRepository.js';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const SEED_DEFINITIONS: InsertInput[] = [
  { userId: 0, name: 'Running', type: 'workout' },
  { userId: 0, name: 'Rowing', type: 'workout' },
  { userId: 0, name: 'Writing', type: 'writing' },
  { userId: 0, name: 'Reading', type: 'custom', positive: true },
  { userId: 0, name: 'Meat consuming', type: 'custom', positive: false },
  { userId: 0, name: 'Fast food consuming', type: 'custom', positive: false },
  { userId: 0, name: 'Cooking', type: 'custom', positive: true },
  { userId: 0, name: 'Social interactions', type: 'custom', positive: true },
];

function toHabitDefinition(row: DbHabitDefinition, hasEntries = false): HabitDefinition {
  return {
    id: row.id,
    userId: row.userId!,
    name: row.name,
    type: row.type,
    positive: row.positive,
    color: row.color,
    createdAt: row.createdAt,
    hasEntries,
  };
}

function definitionsWithEntries(tx?: Tx): Set<number> {
  const client = tx ?? db;
  const rows = client.selectDistinct({ id: entries.habitDefinitionId }).from(entries).all();
  return new Set(rows.map((r) => r.id));
}

export class DrizzleHabitDefinitionRepository implements HabitDefinitionRepository {
  constructor(private readonly entryRepo?: EntryRepository) {}

  listByUser(userId: number): HabitDefinition[] {
    const rows = db
      .select()
      .from(habitDefinitions)
      .where(eq(habitDefinitions.userId, userId))
      .orderBy(asc(habitDefinitions.id))
      .all();
    const withEntries = definitionsWithEntries();
    return rows.map((row) => toHabitDefinition(row, withEntries.has(row.id)));
  }

  findById(id: number): HabitDefinition | undefined {
    const row = db.select().from(habitDefinitions).where(eq(habitDefinitions.id, id)).get();
    if (!row) return undefined;
    const hasEntries = this.entryRepo?.hasEntriesForDefinition(id) ?? false;
    return toHabitDefinition(row, hasEntries);
  }

  insert(input: InsertInput): HabitDefinition {
    return db.transaction((tx) => {
      const user = tx.select().from(users).where(eq(users.id, input.userId)).get();
      if (!user) throw new UserNotFoundError(input.userId);

      const positive = resolvePositive(input.type, input.positive);
      const positiveCount = this.countPositiveByUserInTx(input.userId, tx);
      const color = pickColor(positive, positiveCount);

      const inserted = tx
        .insert(habitDefinitions)
        .values({ userId: input.userId, name: input.name, type: input.type, positive, color })
        .returning()
        .get();

      return toHabitDefinition(inserted, false);
    });
  }

  update(id: number, patch: HabitPatch): HabitDefinition {
    return db.transaction((tx) => {
      const row = tx.select().from(habitDefinitions).where(eq(habitDefinitions.id, id)).get();
      if (!row) throw new HabitDefinitionNotFoundError(id);

      const hasEntries = this.entryRepo?.hasEntriesForDefinition(id) ?? false;
      const existing = toHabitDefinition(row, hasEntries);
      const updates = applyPatch(existing, patch, hasEntries);

      if (Object.keys(updates).length === 0) {
        return existing;
      }

      const updated = tx
        .update(habitDefinitions)
        .set(updates)
        .where(eq(habitDefinitions.id, id))
        .returning()
        .get();

      return toHabitDefinition(updated, hasEntries);
    });
  }

  delete(id: number): void {
    db.transaction((tx) => {
      const row = tx.select().from(habitDefinitions).where(eq(habitDefinitions.id, id)).get();
      if (!row) throw new HabitDefinitionNotFoundError(id);

      if (this.entryRepo?.hasEntriesForDefinition(id)) throw new HasEntriesError();

      tx.delete(habitDefinitions).where(eq(habitDefinitions.id, id)).run();
    });
  }

  countPositiveByUser(userId: number): number {
    return db
      .select()
      .from(habitDefinitions)
      .where(and(eq(habitDefinitions.userId, userId), eq(habitDefinitions.positive, true)))
      .all().length;
  }

  seedFor(userId: number): void {
    for (const def of SEED_DEFINITIONS) {
      this.insert({ ...def, userId });
    }
  }

  private countPositiveByUserInTx(userId: number, tx: Tx): number {
    return tx
      .select()
      .from(habitDefinitions)
      .where(and(eq(habitDefinitions.userId, userId), eq(habitDefinitions.positive, true)))
      .all().length;
  }
}
