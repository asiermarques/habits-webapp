import { and, desc, eq, inArray, lt, or, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  entries,
  entryWorkoutData,
  entryWritingData,
  entryCustomData,
  habitDefinitions,
  users,
} from '../db/schema.js';
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

export const PAGE_SIZE = 20;

export type ListFilters = {
  userId: number;
  habitDefinitionId?: number;
  cursor?: EntryCursor;
  limit?: number;
};

type EntryRow = {
  id: number;
  habitDefinitionId: number;
  userId: number;
  date: string;
  createdAt: string;
  type: HabitType;
};

function fetchEntryRows(filters: ListFilters): { rows: EntryRow[]; nextCursor: EntryCursor | null } {
  const limit = filters.limit ?? PAGE_SIZE;
  const conditions = [eq(entries.userId, filters.userId)];

  if (filters.habitDefinitionId !== undefined) {
    conditions.push(eq(entries.habitDefinitionId, filters.habitDefinitionId));
  }

  if (filters.cursor) {
    // Strict "less than (date, id)" tuple comparison.
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
      amount: r.amount,
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
      binary: r.binary,
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

export function listEntries(filters: ListFilters): EntriesPage {
  const { rows, nextCursor } = fetchEntryRows(filters);
  return { items: attachData(rows), nextCursor };
}

export function getEntry(id: number): Entry | undefined {
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

// --- Mutations ---

export type CreateInput = {
  habitDefinitionId: number;
  userId: number;
  date: string;
  data: EntryData;
};

export type CreateResult =
  | { status: 'ok'; entry: Entry }
  | { status: 'definition_not_found' }
  | { status: 'user_not_found' }
  | { status: 'invalid_data'; reason: string };

export function createEntry(input: CreateInput): CreateResult {
  return db.transaction((tx) => {
    const definition = tx
      .select()
      .from(habitDefinitions)
      .where(eq(habitDefinitions.id, input.habitDefinitionId))
      .get();
    if (!definition) return { status: 'definition_not_found' as const };

    const user = tx.select().from(users).where(eq(users.id, input.userId)).get();
    if (!user) return { status: 'user_not_found' as const };

    const validation = validateData(definition.type, input.data);
    if (validation) return { status: 'invalid_data' as const, reason: validation };

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
      status: 'ok' as const,
      entry: {
        id: inserted.id,
        habitDefinitionId: inserted.habitDefinitionId,
        userId: inserted.userId,
        date: inserted.date,
        createdAt: inserted.createdAt,
        type: definition.type,
        data: input.data,
      },
    };
  });
}

export type UpdateInput = {
  date?: string;
  data?: EntryData;
};

export type UpdateResult =
  | { status: 'ok'; entry: Entry }
  | { status: 'not_found' }
  | { status: 'invalid_data'; reason: string };

export function updateEntry(id: number, patch: UpdateInput): UpdateResult {
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

    if (!existing) return { status: 'not_found' as const };

    if (patch.data) {
      const validation = validateData(existing.type, patch.data);
      if (validation) return { status: 'invalid_data' as const, reason: validation };
    }

    if (patch.date !== undefined) {
      tx.update(entries).set({ date: patch.date }).where(eq(entries.id, id)).run();
      existing.date = patch.date;
    }

    if (patch.data) {
      replaceChild(tx, id, existing.type, patch.data);
    }

    const fresh = getEntry(id)!;
    return { status: 'ok' as const, entry: fresh };
  });
}

export type DeleteResult = 'ok' | 'not_found';

export function deleteEntry(id: number): DeleteResult {
  return db.transaction((tx) => {
    const existing = tx.select().from(entries).where(eq(entries.id, id)).get();
    if (!existing) return 'not_found';

    // Child rows cascade via foreign keys.
    tx.delete(entries).where(eq(entries.id, id)).run();
    return 'ok';
  });
}

// Used by habit-definitions repository to enforce type-lock and delete-block.
// Accepts an optional transaction so callers can run the check inside the same
// atomic scope as their own mutation.
export function hasEntriesForDefinition(habitDefinitionId: number, tx?: Tx): boolean {
  const client = tx ?? db;
  const result = client
    .select({ count: sql<number>`count(*)` })
    .from(entries)
    .where(eq(entries.habitDefinitionId, habitDefinitionId))
    .get();
  return (result?.count ?? 0) > 0;
}

// --- helpers ---

function validateData(type: HabitType, data: EntryData): string | null {
  if (type === 'workout') {
    const d = data as WorkoutData;
    if (typeof d.duration !== 'number' || d.duration <= 0) {
      return 'workout entries require a positive `duration`';
    }
    return null;
  }
  if (type === 'writing') {
    const d = data as WritingData;
    if (typeof d.words !== 'number' || d.words < 0) {
      return 'writing entries require a non-negative `words`';
    }
    return null;
  }
  return null; // custom: all fields optional
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function insertChild(tx: Tx, entryId: number, type: HabitType, data: EntryData) {
  if (type === 'workout') {
    const d = data as WorkoutData;
    tx.insert(entryWorkoutData)
      .values({
        entryId,
        duration: d.duration,
        distance: d.distance ?? null,
        weight: d.weight ?? null,
        amount: d.amount ?? null,
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
        binary: d.binary ?? null,
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
