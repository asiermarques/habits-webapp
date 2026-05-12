// READ MODEL — by-habit weekly breakdown query.
import { and, eq, gte, lte } from 'drizzle-orm';
import { db } from '../../shared/infrastructure/db/index.js';
import { entries, entryCustomData, entryWorkoutData } from '../../shared/infrastructure/db/schema.js';
import type { ByHabitMetrics, ByHabitWeek, HabitCount } from '@habitsapp/shared';
import { REP_COUNT_SQL } from './sql-fragments.js';
import { addDaysIso, byTypeRange, isoToday, weekStartFor } from './date-utils.js';

export type RangeInput = {
  userId: number;
  today?: string;
};

export function getByHabitMetrics({ userId, today }: RangeInput): ByHabitMetrics {
  const anchor = today ?? isoToday();
  const { rangeStart, rangeEnd, weekStarts } = byTypeRange(anchor);

  const rows = db
    .select({
      date: entries.date,
      habitDefinitionId: entries.habitDefinitionId,
      count: REP_COUNT_SQL,
    })
    .from(entries)
    .leftJoin(entryWorkoutData, eq(entryWorkoutData.entryId, entries.id))
    .leftJoin(entryCustomData, eq(entryCustomData.entryId, entries.id))
    .where(and(eq(entries.userId, userId), gte(entries.date, rangeStart), lte(entries.date, rangeEnd)))
    .groupBy(entries.date, entries.habitDefinitionId)
    .all();

  const byWeekStart = new Map<string, Map<number, number>>();
  for (const ws of weekStarts) byWeekStart.set(ws, new Map());

  for (const r of rows) {
    const ws = weekStartFor(r.date);
    const bucket = byWeekStart.get(ws);
    if (!bucket) continue;
    bucket.set(r.habitDefinitionId, (bucket.get(r.habitDefinitionId) ?? 0) + Number(r.count));
  }

  const weeks: ByHabitWeek[] = weekStarts.map((weekStart) => {
    const bucket = byWeekStart.get(weekStart)!;
    const habits: HabitCount[] = [];
    for (const [habitDefinitionId, count] of bucket) {
      habits.push({ habitDefinitionId, count });
    }
    return { weekStart, weekEnd: addDaysIso(weekStart, 6), habits };
  });

  return { rangeStart, rangeEnd, weeks };
}
