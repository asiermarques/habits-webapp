import type { HabitCount, WeeklyMetrics } from '@habitsapp/shared';
import type { PendingEntryRecord } from '@/entries/offlineStore';
import { repCount } from '@/entries/repCount';

// Overlays pending offline Entry creates onto server-derived weekly metrics
// (requisites FR-002 — the weekly chart, same as the Home entries list).
// Mirrors the backend's repetition-counting rule (BR-006) via `repCount`.
export function mergePendingIntoWeekly(
  weekly: WeeklyMetrics,
  pending: PendingEntryRecord[],
  habitDefinitionId?: number,
): WeeklyMetrics {
  const relevant = pending.filter(
    (p) =>
      p.date >= weekly.weekStart &&
      p.date <= weekly.weekEnd &&
      (habitDefinitionId === undefined || p.habitDefinitionId === habitDefinitionId),
  );
  if (relevant.length === 0) return weekly;

  return {
    ...weekly,
    days: weekly.days.map((day) => {
      const additions = relevant.filter((p) => p.date === day.date);
      if (additions.length === 0) return day;

      const counts = new Map(day.counts.map((c) => [c.habitDefinitionId, c.count]));
      for (const p of additions) {
        const current = counts.get(p.habitDefinitionId) ?? 0;
        counts.set(p.habitDefinitionId, current + repCount(p.type, p.data));
      }
      const merged: HabitCount[] = [...counts].map(([id, count]) => ({
        habitDefinitionId: id,
        count,
      }));
      return { ...day, counts: merged };
    }),
  };
}
