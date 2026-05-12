// READ MODEL — heatmap query.
import { and, eq, gte, lte } from 'drizzle-orm';
import { db } from '../../shared/db/index.js';
import { entries, entryCustomData, entryWorkoutData, habitDefinitions } from '../../shared/db/schema.js';
import type { HabitHeatmap, HeatmapDay, HeatmapMetrics } from '@habitsapp/shared';
import { REP_COUNT_SQL } from './sql-fragments.js';
import { heatmapRange, isoToday } from './date-utils.js';

export type RangeInput = {
  userId: number;
  today?: string;
};

export function getHeatmapMetrics({ userId, today }: RangeInput): HeatmapMetrics {
  const anchor = today ?? isoToday();
  const { rangeStart, rangeEnd } = heatmapRange(anchor);

  const rows = db
    .select({
      habitDefinitionId: entries.habitDefinitionId,
      date: entries.date,
      count: REP_COUNT_SQL,
    })
    .from(entries)
    .leftJoin(entryWorkoutData, eq(entryWorkoutData.entryId, entries.id))
    .leftJoin(entryCustomData, eq(entryCustomData.entryId, entries.id))
    .where(and(eq(entries.userId, userId), gte(entries.date, rangeStart), lte(entries.date, rangeEnd)))
    .groupBy(entries.habitDefinitionId, entries.date)
    .all();

  const allDefs = db.select({ id: habitDefinitions.id }).from(habitDefinitions).all();

  const byDef = new Map<number, HeatmapDay[]>();
  for (const def of allDefs) byDef.set(def.id, []);

  for (const r of rows) {
    const list = byDef.get(r.habitDefinitionId) ?? [];
    list.push({ date: r.date, count: Number(r.count) });
    byDef.set(r.habitDefinitionId, list);
  }

  const habits: HabitHeatmap[] = [];
  for (const [habitDefinitionId, days] of byDef) {
    days.sort((a, b) => a.date.localeCompare(b.date));
    habits.push({ habitDefinitionId, days });
  }
  // Most recently active first; habits with no entries sink to the bottom;
  // ties break by id for stability.
  habits.sort((a, b) => {
    const aLatest = a.days.length ? a.days[a.days.length - 1].date : '';
    const bLatest = b.days.length ? b.days[b.days.length - 1].date : '';
    if (aLatest !== bLatest) return bLatest.localeCompare(aLatest);
    return a.habitDefinitionId - b.habitDefinitionId;
  });

  return { rangeStart, rangeEnd, habits };
}
