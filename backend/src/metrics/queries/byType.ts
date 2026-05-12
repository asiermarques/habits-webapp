// READ MODEL — by-type weekly breakdown query.
import { and, eq, gte, lte } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { entries, entryCustomData, entryWorkoutData, habitDefinitions } from '../../db/schema.js';
import type { ByTypeMetrics, ByTypeWeek, HabitType } from '@habitsapp/shared';
import { REP_COUNT_SQL } from './sql-fragments.js';
import { addDaysIso, byTypeRange, isoToday } from './date-utils.js';

export type RangeInput = {
  userId: number;
  today?: string;
};

export function getByTypeMetrics({ userId, today }: RangeInput): ByTypeMetrics {
  const anchor = today ?? isoToday();
  const { rangeStart, rangeEnd, weekStarts } = byTypeRange(anchor);

  const rows = db
    .select({
      date: entries.date,
      type: habitDefinitions.type,
      count: REP_COUNT_SQL,
    })
    .from(entries)
    .innerJoin(habitDefinitions, eq(entries.habitDefinitionId, habitDefinitions.id))
    .leftJoin(entryWorkoutData, eq(entryWorkoutData.entryId, entries.id))
    .leftJoin(entryCustomData, eq(entryCustomData.entryId, entries.id))
    .where(and(eq(entries.userId, userId), gte(entries.date, rangeStart), lte(entries.date, rangeEnd)))
    .groupBy(entries.date, habitDefinitions.type)
    .all();

  const byWeekStart = new Map<string, { workout: number; writing: number; custom: number }>();
  for (const ws of weekStarts) {
    byWeekStart.set(ws, { workout: 0, writing: 0, custom: 0 });
  }

  for (const r of rows) {
    const ws = weekStartForDate(r.date);
    const bucket = byWeekStart.get(ws);
    if (!bucket) continue;
    bucket[r.type as HabitType] += Number(r.count);
  }

  const weeks: ByTypeWeek[] = weekStarts.map((weekStart) => ({
    weekStart,
    weekEnd: addDaysIso(weekStart, 6),
    ...byWeekStart.get(weekStart)!,
  }));

  return { rangeStart, rangeEnd, weeks };
}

function weekStartForDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const daysSinceMonday = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - daysSinceMonday);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}
