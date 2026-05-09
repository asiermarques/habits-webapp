import { asc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { habitDefinitions, type DbHabitDefinition } from '../db/schema.js';
import type { HabitDefinition, HabitType } from '@habitsapp/shared';
import { pickColor } from './colors.js';

function toHabitDefinition(row: DbHabitDefinition): HabitDefinition {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    positive: row.positive,
    color: row.color,
    createdAt: row.createdAt,
  };
}

// Workout and Writing are always positive — Custom is the only type with an explicit flag.
function resolvePositive(type: HabitType, positive?: boolean): boolean {
  if (type === 'workout' || type === 'writing') return true;
  return positive ?? true;
}

export function listHabitDefinitions(): HabitDefinition[] {
  return db
    .select()
    .from(habitDefinitions)
    .orderBy(asc(habitDefinitions.id))
    .all()
    .map(toHabitDefinition);
}

export type CreateInput = {
  name: string;
  type: HabitType;
  positive?: boolean;
};

export function createHabitDefinition(input: CreateInput): HabitDefinition {
  return db.transaction((tx) => {
    const positive = resolvePositive(input.type, input.positive);
    const positiveCount = tx
      .select()
      .from(habitDefinitions)
      .where(eq(habitDefinitions.positive, true))
      .all().length;

    const color = pickColor(positive, positiveCount);

    const inserted = tx
      .insert(habitDefinitions)
      .values({ name: input.name, type: input.type, positive, color })
      .returning()
      .get();

    return toHabitDefinition(inserted);
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

    const typeChanging = patch.type !== undefined && patch.type !== existing.type;
    if (typeChanging && hasEntriesForDefinition(id)) {
      return { status: 'type_locked' as const };
    }

    const newType = patch.type ?? existing.type;
    const newPositive =
      patch.positive !== undefined ? resolvePositive(newType, patch.positive) : resolvePositive(newType, existing.positive);

    const updates: Partial<DbHabitDefinition> = {};
    if (patch.name !== undefined) updates.name = patch.name;
    if (patch.type !== undefined) updates.type = patch.type;
    updates.positive = newPositive;

    if (Object.keys(updates).length === 0) {
      return { status: 'ok' as const, definition: toHabitDefinition(existing) };
    }

    const updated = tx
      .update(habitDefinitions)
      .set(updates)
      .where(eq(habitDefinitions.id, id))
      .returning()
      .get();

    return { status: 'ok' as const, definition: toHabitDefinition(updated) };
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

    if (hasEntriesForDefinition(id)) return 'has_entries';

    tx.delete(habitDefinitions).where(eq(habitDefinitions.id, id)).run();
    return 'ok';
  });
}

// Placeholder until Slice 3 introduces the entries table.
// Once entries land, this should query the entries table for any row referencing `id`.
function hasEntriesForDefinition(_id: number): boolean {
  return false;
}
