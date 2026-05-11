import { and, asc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { entries, habitDefinitions, users, type DbHabitDefinition } from '../db/schema.js';
import type { HabitDefinition, HabitType } from '@habitsapp/shared';
import { pickColor } from './colors.js';
import { hasEntriesForDefinition } from '../entries/repository.js';

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

function definitionsWithEntries(): Set<number> {
  const rows = db
    .selectDistinct({ id: entries.habitDefinitionId })
    .from(entries)
    .all();
  return new Set(rows.map((r) => r.id));
}

// Workout and Writing are always positive — Custom is the only type with an explicit flag.
function resolvePositive(type: HabitType, positive?: boolean): boolean {
  if (type === 'workout' || type === 'writing') return true;
  return positive ?? true;
}

export function listHabitDefinitions(userId: number): HabitDefinition[] {
  const rows = db
    .select()
    .from(habitDefinitions)
    .where(eq(habitDefinitions.userId, userId))
    .orderBy(asc(habitDefinitions.id))
    .all();
  const withEntries = definitionsWithEntries();
  return rows.map((row) => toHabitDefinition(row, withEntries.has(row.id)));
}

export type CreateInput = {
  userId: number;
  name: string;
  type: HabitType;
  positive?: boolean;
};

export type CreateResult =
  | { status: 'ok'; definition: HabitDefinition }
  | { status: 'user_not_found' };

export function createHabitDefinition(input: CreateInput): CreateResult {
  return db.transaction((tx) => {
    const user = tx.select().from(users).where(eq(users.id, input.userId)).get();
    if (!user) return { status: 'user_not_found' as const };

    const positive = resolvePositive(input.type, input.positive);
    const positiveCount = tx
      .select()
      .from(habitDefinitions)
      .where(and(eq(habitDefinitions.userId, input.userId), eq(habitDefinitions.positive, true)))
      .all().length;

    const color = pickColor(positive, positiveCount);

    const inserted = tx
      .insert(habitDefinitions)
      .values({ userId: input.userId, name: input.name, type: input.type, positive, color })
      .returning()
      .get();

    return { status: 'ok' as const, definition: toHabitDefinition(inserted, false) };
  });
}

export type UpdateInput = {
  name?: string;
  type?: HabitType;
  positive?: boolean;
};

export type UpdateResult =
  | { status: 'ok'; definition: HabitDefinition }
  | { status: 'not_found' }
  | { status: 'type_locked' };

export function updateHabitDefinition(id: number, patch: UpdateInput): UpdateResult {
  return db.transaction((tx) => {
    const existing = tx
      .select()
      .from(habitDefinitions)
      .where(eq(habitDefinitions.id, id))
      .get();
    if (!existing) return { status: 'not_found' as const };

    const hasEntries = hasEntriesForDefinition(id, tx);
    const typeChanging = patch.type !== undefined && patch.type !== existing.type;
    if (typeChanging && hasEntries) {
      return { status: 'type_locked' as const };
    }

    const newType = patch.type ?? existing.type;
    const newPositive =
      patch.positive !== undefined ? resolvePositive(newType, patch.positive) : resolvePositive(newType, existing.positive);

    const updates: Partial<DbHabitDefinition> = {};
    if (patch.name !== undefined) updates.name = patch.name;
    if (patch.type !== undefined) updates.type = patch.type;
    if (newPositive !== existing.positive) updates.positive = newPositive;

    if (Object.keys(updates).length === 0) {
      return { status: 'ok' as const, definition: toHabitDefinition(existing, hasEntries) };
    }

    const updated = tx
      .update(habitDefinitions)
      .set(updates)
      .where(eq(habitDefinitions.id, id))
      .returning()
      .get();

    return { status: 'ok' as const, definition: toHabitDefinition(updated, hasEntries) };
  });
}

export type DeleteResult = 'ok' | 'not_found' | 'has_entries';

export function deleteHabitDefinition(id: number): DeleteResult {
  return db.transaction((tx) => {
    const existing = tx
      .select()
      .from(habitDefinitions)
      .where(eq(habitDefinitions.id, id))
      .get();
    if (!existing) return 'not_found';

    if (hasEntriesForDefinition(id, tx)) return 'has_entries';

    tx.delete(habitDefinitions).where(eq(habitDefinitions.id, id)).run();
    return 'ok';
  });
}
