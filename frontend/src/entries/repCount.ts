import type { CustomData, EntryData, HabitType, WorkoutData } from '@habitsapp/shared';

// Mirrors the backend's REP_COUNT_SQL (backend/src/metrics/queries/sql-fragments.ts):
// workout/custom entries contribute their `number` field when present,
// everything else counts as 1 (BR-006 — counting rules are unchanged offline).
export function repCount(type: HabitType, data: EntryData): number {
  if (type === 'workout' || type === 'custom') {
    const number = (data as WorkoutData | CustomData).number;
    if (typeof number === 'number' && Number.isFinite(number)) return number;
  }
  return 1;
}
