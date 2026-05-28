// READ MODEL — no domain layer, just joined read queries that assemble a
// portable backup bundle for one user (definitions + entries).
import { asc, eq, inArray } from 'drizzle-orm';
import { db } from '../../shared/db/index.js';
import {
  entries,
  entryWorkoutData,
  entryWritingData,
  entryCustomData,
  habitDefinitions,
} from '../../shared/db/schema.js';
import {
  BACKUP_VERSION,
  type BackupBundle,
  type BackupEntry,
  type BackupHabitDefinition,
  type EntryData,
  type HabitType,
} from '@habitsapp/shared';

// Drops null/undefined fields so the exported JSON stays compact and only
// carries the data a habit type actually uses.
function compact<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== null && v !== undefined),
  ) as T;
}

export function buildBackup(userId: number, today: string): BackupBundle {
  const defs = db
    .select()
    .from(habitDefinitions)
    .where(eq(habitDefinitions.userId, userId))
    .orderBy(asc(habitDefinitions.id))
    .all();

  const habitDefinitionsOut: BackupHabitDefinition[] = defs.map((d) => ({
    name: d.name,
    type: d.type,
    positive: d.positive,
    color: d.color,
  }));

  const idToName = new Map(defs.map((d) => [d.id, d.name]));

  const entryRows = db
    .select({
      id: entries.id,
      habitDefinitionId: entries.habitDefinitionId,
      date: entries.date,
      type: habitDefinitions.type,
    })
    .from(entries)
    .innerJoin(habitDefinitions, eq(entries.habitDefinitionId, habitDefinitions.id))
    .where(eq(entries.userId, userId))
    .orderBy(asc(entries.date), asc(entries.id))
    .all() as { id: number; habitDefinitionId: number; date: string; type: HabitType }[];

  const ids = entryRows.map((r) => r.id);
  const workout = new Map<number, EntryData>();
  const writing = new Map<number, EntryData>();
  const custom = new Map<number, EntryData>();

  if (ids.length > 0) {
    for (const r of db.select().from(entryWorkoutData).where(inArray(entryWorkoutData.entryId, ids)).all()) {
      workout.set(
        r.entryId,
        compact({ duration: r.duration, distance: r.distance, weight: r.weight, number: r.number, notes: r.notes }),
      );
    }
    for (const r of db.select().from(entryWritingData).where(inArray(entryWritingData.entryId, ids)).all()) {
      writing.set(r.entryId, compact({ words: r.words, time: r.time }));
    }
    for (const r of db.select().from(entryCustomData).where(inArray(entryCustomData.entryId, ids)).all()) {
      custom.set(r.entryId, compact({ number: r.number, amount: r.amount, duration: r.duration }));
    }
  }

  const entriesOut: BackupEntry[] = entryRows.map((r) => {
    const data =
      r.type === 'workout'
        ? workout.get(r.id)
        : r.type === 'writing'
        ? writing.get(r.id)
        : custom.get(r.id);
    return {
      habitName: idToName.get(r.habitDefinitionId)!,
      date: r.date,
      data: data ?? ({} as EntryData),
    };
  });

  return {
    version: BACKUP_VERSION,
    exportedAt: today,
    habitDefinitions: habitDefinitionsOut,
    entries: entriesOut,
  };
}
