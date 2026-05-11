import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  entries,
  entryWorkoutData,
  entryWritingData,
  entryCustomData,
  habitDefinitions,
} from '../db/schema.js';
import type { HabitType } from '@habitsapp/shared';

export type ExportRow = {
  date: string;
  habitName: string;
  type: HabitType;
  positive: boolean;
  duration: number | null;
  distance: number | null;
  weight: number | null;
  amount: number | null;
  notes: string | null;
  words: number | null;
  time: number | null;
  number: number | null;
};

export type ExportInput = {
  userId: number;
  from: string; // YYYY-MM-DD inclusive
  to: string;   // YYYY-MM-DD inclusive
};

export function getExportRows({ userId, from, to }: ExportInput): ExportRow[] {
  const rows = db
    .select({
      date: entries.date,
      habitName: habitDefinitions.name,
      type: habitDefinitions.type,
      positive: habitDefinitions.positive,
      workoutDuration: entryWorkoutData.duration,
      workoutDistance: entryWorkoutData.distance,
      workoutWeight: entryWorkoutData.weight,
      workoutNumber: entryWorkoutData.number,
      workoutNotes: entryWorkoutData.notes,
      writingWords: entryWritingData.words,
      writingTime: entryWritingData.time,
      customNumber: entryCustomData.number,
      customAmount: entryCustomData.amount,
      customDuration: entryCustomData.duration,
    })
    .from(entries)
    .innerJoin(habitDefinitions, eq(entries.habitDefinitionId, habitDefinitions.id))
    .leftJoin(entryWorkoutData, eq(entryWorkoutData.entryId, entries.id))
    .leftJoin(entryWritingData, eq(entryWritingData.entryId, entries.id))
    .leftJoin(entryCustomData, eq(entryCustomData.entryId, entries.id))
    .where(
      and(
        eq(entries.userId, userId),
        gte(entries.date, from),
        lte(entries.date, to),
      ),
    )
    .orderBy(asc(entries.date), asc(entries.id))
    .all();

  // `duration` and `number` are shared between workout and custom; merge them
  // — only one of the two side-table joins will have a non-null value per row.
  return rows.map((r) => ({
    date: r.date,
    habitName: r.habitName,
    type: r.type as HabitType,
    positive: !!r.positive,
    duration: r.workoutDuration ?? r.customDuration ?? null,
    distance: r.workoutDistance ?? null,
    weight: r.workoutWeight ?? null,
    amount: r.customAmount ?? null,
    notes: r.workoutNotes ?? null,
    words: r.writingWords ?? null,
    time: r.writingTime ?? null,
    number: r.workoutNumber ?? r.customNumber ?? null,
  }));
}

export const EXPORT_COLUMNS = [
  'date',
  'habit_name',
  'type',
  'positive',
  'duration',
  'distance',
  'weight',
  'amount',
  'notes',
  'words',
  'time',
  'number',
] as const;

export function rowsToCsv(rows: ExportRow[]): string {
  const header = EXPORT_COLUMNS.join(',');
  const lines = rows.map((r) =>
    [
      r.date,
      r.habitName,
      r.type,
      r.positive,
      r.duration,
      r.distance,
      r.weight,
      r.amount,
      r.notes,
      r.words,
      r.time,
      r.number,
    ]
      .map(csvEscape)
      .join(','),
  );
  // Trailing newline keeps tools like `wc -l` honest.
  return [header, ...lines].join('\n') + '\n';
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  const s = String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
