import { and, desc, eq, inArray, lt, or, sql } from 'drizzle-orm';
import { db } from '../../shared/db/index.js';
import {
  entries,
  entryWorkoutData,
  entryWritingData,
  entryCustomData,
  habitDefinitions,
  users,
} from '../../shared/db/schema.js';
import type {
  Entry,
  EntryCursor,
  EntryData,
  EntriesPage,
  HabitType,
  CustomData,
  WorkoutData,
  WritingData,
} from '@habitsapp/shared';
import type { EntryRepository, ListFilters, InsertInput, UpdateInput } from '../domain/EntryRepository.js';
import { EntryNotFoundError, DefinitionNotFoundError } from '../domain/errors.js';
import { enforceOwnership } from '../domain/Entry.js';
import { validateEntryData } from '../domain/EntryData.js';
import { UserNotFoundError } from '../../users/domain/errors.js';

export const PAGE_SIZE = 20;

type EntryRow = {
  id: number;
  habitDefinitionId: number;
  userId: number;
  date: string;
  createdAt: string;
  type: HabitType;
};

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function fetchEntryRows(filters: ListFilters): { rows: EntryRow[]; nextCursor: EntryCursor | null } {
  const limit = filters.limit ?? PAGE_SIZE;
  const conditions = [eq(entries.userId, filters.userId)];

  if (filters.habitDefinitionId !== undefined) {
    conditions.push(eq(entries.habitDefinitionId, filters.habitDefinitionId));
  }

  if (filters.cursor) {
    conditions.push(
      or(
        lt(entries.date, filters.cursor.date),
        and(eq(entries.date, filters.cursor.date), lt(entries.id, filters.cursor.id))!,
      )!,
    );
  }

  const rows = db
    .select({
      id: entries.id,
      habitDefinitionId: entries.habitDefinitionId,
      userId: entries.userId,
      date: entries.date,
      createdAt: entries.createdAt,
      type: habitDefinitions.type,
    })
    .from(entries)
    .innerJoin(habitDefinitions, eq(entries.habitDefinitionId, habitDefinitions.id))
    .where(and(...conditions))
    .orderBy(desc(entries.date), desc(entries.id))
    .limit(limit + 1)
    .all() as EntryRow[];

  let nextCursor: EntryCursor | null = null;
  if (rows.length > limit) {
    const last = rows[limit - 1];
    nextCursor = { date: last.date, id: last.id };
    rows.length = limit;
  }

  return { rows, nextCursor };
}

function attachData(rows: EntryRow[]): Entry[] {
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);

  const workoutMap = new Map<number, WorkoutData>();
  const writingMap = new Map<number, WritingData>();
  const customMap = new Map<number, CustomData>();

  for (const r of db.select().from(entryWorkoutData).where(inArray(entryWorkoutData.entryId, ids)).all()) {
    workoutMap.set(r.entryId, {
      duration: r.duration,
      distance: r.distance,
      weight: r.weight,
      number: r.number,
      notes: r.notes,
    });
  }
  for (const r of db.select().from(entryWritingData).where(inArray(entryWritingData.entryId, ids)).all()) {
    writingMap.set(r.entryId, { words: r.words, time: r.time });
  }
  for (const r of db.select().from(entryCustomData).where(inArray(entryCustomData.entryId, ids)).all()) {
    customMap.set(r.entryId, {
      number: r.number,
      amount: r.amount,
      duration: r.duration,
    });
  }

  return rows.map((row) => {
    const data: EntryData =
      row.type === 'workout'
        ? workoutMap.get(row.id)!
        : row.type === 'writing'
        ? writingMap.get(row.id)!
        : customMap.get(row.id)!;
    return { ...row, data };
  });
}

function insertChild(tx: Tx, entryId: number, type: HabitType, data: EntryData) {
  if (type === 'workout') {
    const d = data as WorkoutData;
    tx.insert(entryWorkoutData)
      .values({
        entryId,
        duration: d.duration,
        distance: d.distance ?? null,
        weight: d.weight ?? null,
        number: d.number ?? null,
        notes: d.notes ?? null,
      })
      .run();
  } else if (type === 'writing') {
    const d = data as WritingData;
    tx.insert(entryWritingData).values({ entryId, words: d.words, time: d.time ?? null }).run();
  } else {
    const d = data as CustomData;
    tx.insert(entryCustomData)
      .values({
        entryId,
        number: d.number ?? null,
        amount: d.amount ?? null,
        duration: d.duration ?? null,
      })
      .run();
  }
}

function replaceChild(tx: Tx, entryId: number, type: HabitType, data: EntryData) {
  if (type === 'workout') {
    tx.delete(entryWorkoutData).where(eq(entryWorkoutData.entryId, entryId)).run();
  } else if (type === 'writing') {
    tx.delete(entryWritingData).where(eq(entryWritingData.entryId, entryId)).run();
  } else {
    tx.delete(entryCustomData).where(eq(entryCustomData.entryId, entryId)).run();
  }
  insertChild(tx, entryId, type, data);
}

export class DrizzleEntryRepository implements EntryRepository {
  list(filters: ListFilters): EntriesPage {
    const { rows, nextCursor } = fetchEntryRows(filters);
    return { items: attachData(rows), nextCursor };
  }

  findById(id: number): Entry | undefined {
    const row = db
      .select({
        id: entries.id,
        habitDefinitionId: entries.habitDefinitionId,
        userId: entries.userId,
        date: entries.date,
        createdAt: entries.createdAt,
        type: habitDefinitions.type,
      })
      .from(entries)
      .innerJoin(habitDefinitions, eq(entries.habitDefinitionId, habitDefinitions.id))
      .where(eq(entries.id, id))
      .get() as EntryRow | undefined;

    if (!row) return undefined;
    return attachData([row])[0];
  }

  insert(input: InsertInput): Entry {
    return db.transaction((tx) => {
      const definition = tx
        .select()
        .from(habitDefinitions)
        .where(eq(habitDefinitions.id, input.habitDefinitionId))
        .get();
      if (!definition) throw new DefinitionNotFoundError(input.habitDefinitionId);

      const user = tx.select().from(users).where(eq(users.id, input.userId)).get();
      if (!user) throw new UserNotFoundError(input.userId);

      enforceOwnership(definition.userId!, input.userId);
      validateEntryData(definition.type, input.data);

      const inserted = tx
        .insert(entries)
        .values({
          habitDefinitionId: input.habitDefinitionId,
          userId: input.userId,
          date: input.date,
        })
        .returning()
        .get();

      insertChild(tx, inserted.id, definition.type, input.data);

      return {
        id: inserted.id,
        habitDefinitionId: inserted.habitDefinitionId,
        userId: inserted.userId,
        date: inserted.date,
        createdAt: inserted.createdAt,
        type: definition.type,
        data: input.data,
      };
    });
  }

  update(id: number, patch: UpdateInput): Entry {
    return db.transaction((tx) => {
      const existing = tx
        .select({
          id: entries.id,
          habitDefinitionId: entries.habitDefinitionId,
          userId: entries.userId,
          date: entries.date,
          createdAt: entries.createdAt,
          type: habitDefinitions.type,
        })
        .from(entries)
        .innerJoin(habitDefinitions, eq(entries.habitDefinitionId, habitDefinitions.id))
        .where(eq(entries.id, id))
        .get() as EntryRow | undefined;

      if (!existing) throw new EntryNotFoundError(id);

      if (patch.data) {
        validateEntryData(existing.type, patch.data);
      }

      if (patch.date !== undefined) {
        tx.update(entries).set({ date: patch.date }).where(eq(entries.id, id)).run();
      }

      if (patch.data) {
        replaceChild(tx, id, existing.type, patch.data);
      }

      return this.findById(id)!;
    });
  }

  delete(id: number): void {
    db.transaction((tx) => {
      const existing = tx.select().from(entries).where(eq(entries.id, id)).get();
      if (!existing) throw new EntryNotFoundError(id);

      tx.delete(entries).where(eq(entries.id, id)).run();
    });
  }

  hasEntriesForDefinition(id: number): boolean {
    const result = db
      .select({ count: sql<number>`count(*)` })
      .from(entries)
      .where(eq(entries.habitDefinitionId, id))
      .get();
    return (result?.count ?? 0) > 0;
  }
}
