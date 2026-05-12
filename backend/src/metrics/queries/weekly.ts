// READ MODEL — weekly metrics query.
import { and, eq, gte, lte } from 'drizzle-orm';
import { db } from '../../shared/infrastructure/db/index.js';
import { entries, entryCustomData, entryWorkoutData } from '../../shared/infrastructure/db/schema.js';
import type { HabitCount, WeeklyMetrics } from '@habitsapp/shared';
import { REP_COUNT_SQL } from './sql-fragments.js';
import { currentWeekRange, enumerateWeek, isoToday } from './date-utils.js';

export type WeeklyInput = {
  userId: number;
  habitDefinitionId?: number;
  today?: string;
};

export function getWeeklyMetrics({ userId, habitDefinitionId, today }: WeeklyInput): WeeklyMetrics {
  const anchor = today ?? isoToday();
  const { weekStart, weekEnd } = currentWeekRange(anchor);

  const conditions = [
    eq(entries.userId, userId),
    gte(entries.date, weekStart),
    lte(entries.date, weekEnd),
  ];
  if (habitDefinitionId !== undefined) {
    conditions.push(eq(entries.habitDefinitionId, habitDefinitionId));
  }

  const rows = db
    .select({
      date: entries.date,
      habitDefinitionId: entries.habitDefinitionId,
      count: REP_COUNT_SQL,
    })
    .from(entries)
    .leftJoin(entryWorkoutData, eq(entryWorkoutData.entryId, entries.id))
    .leftJoin(entryCustomData, eq(entryCustomData.entryId, entries.id))
    .where(and(...conditions))
    .groupBy(entries.date, entries.habitDefinitionId)
    .all();

  const buckets = new Map<string, HabitCount[]>();
  for (const r of rows) {
    const list = buckets.get(r.date) ?? [];
    list.push({ habitDefinitionId: r.habitDefinitionId, count: Number(r.count) });
    buckets.set(r.date, list);
  }

  const days = enumerateWeek(weekStart).map((date) => ({
    date,
    counts: buckets.get(date) ?? [],
  }));

  return { weekStart, weekEnd, days };
}
