// READ MODEL — shared SQL expression used across all metrics queries.
import { sql } from 'drizzle-orm';
import { entryWorkoutData, entryCustomData } from '../../db/schema.js';

// Counts "times the habit was done" rather than "entries logged":
// workout/custom entries contribute their repetitions field (`number`) when
// present, every other case counts as 1.
export const REP_COUNT_SQL = sql<number>`SUM(COALESCE(${entryWorkoutData.number}, ${entryCustomData.number}, 1))`;
