// READ MODEL — 30-day summary score cards query.
import { and, asc, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '../../shared/db/index.js';
import { entries, entryCustomData, entryWorkoutData, habitDefinitions } from '../../shared/db/schema.js';
import type { HabitCount, SummaryMetrics } from '@habitsapp/shared';
import { REP_COUNT_SQL } from './sql-fragments.js';
import { addDaysIso, isoToday } from './date-utils.js';

export const SUMMARY_DAYS = 30;

export type RangeInput = {
  userId: number;
  today?: string;
};

export function getSummaryMetrics({ userId, today }: RangeInput): SummaryMetrics {
  const anchor = today ?? isoToday();
  const rangeEnd = anchor;
  const rangeStart = addDaysIso(anchor, -(SUMMARY_DAYS - 1));

  const habitCountRows = db
    .select({
      habitDefinitionId: entries.habitDefinitionId,
      count: REP_COUNT_SQL,
    })
    .from(entries)
    .leftJoin(entryWorkoutData, eq(entryWorkoutData.entryId, entries.id))
    .leftJoin(entryCustomData, eq(entryCustomData.entryId, entries.id))
    .where(and(eq(entries.userId, userId), gte(entries.date, rangeStart), lte(entries.date, rangeEnd)))
    .groupBy(entries.habitDefinitionId)
    .all();

  const countsByHabit = new Map<number, number>();
  for (const r of habitCountRows) {
    countsByHabit.set(r.habitDefinitionId, Number(r.count));
  }

  const allDefs = db
    .select({ id: habitDefinitions.id })
    .from(habitDefinitions)
    .where(eq(habitDefinitions.userId, userId))
    .orderBy(asc(habitDefinitions.id))
    .all();

  let mostRegistered: HabitCount | null = null;
  let leastRegistered: HabitCount | null = null;
  let activeHabitsCount = 0;

  for (const def of allDefs) {
    const count = countsByHabit.get(def.id) ?? 0;
    if (count > 0) activeHabitsCount++;

    if (count > 0 && (mostRegistered === null || count > mostRegistered.count)) {
      mostRegistered = { habitDefinitionId: def.id, count };
    }
    if (leastRegistered === null || count < leastRegistered.count) {
      leastRegistered = { habitDefinitionId: def.id, count };
    }
  }

  // Bad-habits total cost: sum of `amount` across custom entries whose habit
  // is negative. Only custom habits can be negative and `amount` is custom-only.
  const badCostRow = db
    .select({ total: sql<number>`COALESCE(SUM(${entryCustomData.amount}), 0)` })
    .from(entries)
    .innerJoin(habitDefinitions, eq(entries.habitDefinitionId, habitDefinitions.id))
    .innerJoin(entryCustomData, eq(entryCustomData.entryId, entries.id))
    .where(
      and(
        eq(entries.userId, userId),
        eq(habitDefinitions.positive, false),
        gte(entries.date, rangeStart),
        lte(entries.date, rangeEnd),
      ),
    )
    .get();
  const badHabitsTotalCost = Number(badCostRow?.total ?? 0);

  return { rangeStart, rangeEnd, mostRegistered, leastRegistered, badHabitsTotalCost, activeHabitsCount };
}
