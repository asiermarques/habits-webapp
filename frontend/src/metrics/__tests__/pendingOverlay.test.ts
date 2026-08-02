import { describe, it, expect } from 'vitest';
import type { WeeklyMetrics } from '@habitsapp/shared';
import type { PendingEntryRecord } from '@/entries/offlineStore';
import { mergePendingIntoWeekly } from '../pendingOverlay';

const weekly: WeeklyMetrics = {
  weekStart: '2026-08-03',
  weekEnd: '2026-08-09',
  days: [
    { date: '2026-08-03', counts: [{ habitDefinitionId: 1, count: 2 }] },
    { date: '2026-08-04', counts: [] },
    { date: '2026-08-05', counts: [] },
    { date: '2026-08-06', counts: [] },
    { date: '2026-08-07', counts: [] },
    { date: '2026-08-08', counts: [] },
    { date: '2026-08-09', counts: [] },
  ],
};

function pendingRecord(overrides: Partial<PendingEntryRecord>): PendingEntryRecord {
  return {
    localId: -1,
    userId: 1,
    habitDefinitionId: 1,
    type: 'workout',
    date: '2026-08-04',
    data: { duration: 30 },
    createdAt: 'now',
    ...overrides,
  };
}

describe('mergePendingIntoWeekly', () => {
  it('adds a new day bucket for a habit with no counts yet that day', () => {
    const merged = mergePendingIntoWeekly(weekly, [pendingRecord({})]);
    const day = merged.days.find((d) => d.date === '2026-08-04')!;
    expect(day.counts).toEqual([{ habitDefinitionId: 1, count: 1 }]);
  });

  it('adds to an existing count on the same day/habit', () => {
    const merged = mergePendingIntoWeekly(weekly, [
      pendingRecord({ date: '2026-08-03', data: { number: 3 } as never, type: 'custom' }),
    ]);
    const day = merged.days.find((d) => d.date === '2026-08-03')!;
    expect(day.counts).toEqual([{ habitDefinitionId: 1, count: 5 }]);
  });

  it('ignores pending entries outside the week range', () => {
    const merged = mergePendingIntoWeekly(weekly, [pendingRecord({ date: '2026-07-20' })]);
    expect(merged).toEqual(weekly);
  });

  it('filters by habitDefinitionId when provided', () => {
    const merged = mergePendingIntoWeekly(
      weekly,
      [pendingRecord({ habitDefinitionId: 2, date: '2026-08-04' })],
      1,
    );
    const day = merged.days.find((d) => d.date === '2026-08-04')!;
    expect(day.counts).toEqual([]);
  });

  it('returns the original object when there is nothing pending', () => {
    expect(mergePendingIntoWeekly(weekly, [])).toBe(weekly);
  });
});
