import type { HabitCount, WeeklyMetrics } from '@habitsapp/shared';
import type { PendingEntryOp, PendingEntryRecord } from '@/entries/offlineStore';
import { repCount } from '@/entries/repCount';

function inWeek(weekly: WeeklyMetrics, date: string): boolean {
  return date >= weekly.weekStart && date <= weekly.weekEnd;
}

// Overlays pending offline Entry creates and deletes onto server-derived
// weekly metrics (requisites FR-002 — the weekly chart, same as the Home
// entries list). Queued *updates* are deliberately not reflected here — only
// the entries list and the delete case are in scope (US-004/US-005 acceptance
// criteria). Mirrors the backend's repetition-counting rule (BR-006) via
// `repCount`.
export function mergePendingIntoWeekly(
  weekly: WeeklyMetrics,
  pending: PendingEntryRecord[],
  ops: PendingEntryOp[],
  habitDefinitionId?: number,
): WeeklyMetrics {
  const matchesHabit = (id: number) => habitDefinitionId === undefined || id === habitDefinitionId;

  const additions = pending.filter((p) => inWeek(weekly, p.date) && matchesHabit(p.habitDefinitionId));
  const deletions = ops.filter(
    (op): op is Extract<PendingEntryOp, { kind: 'delete' }> =>
      op.kind === 'delete' && inWeek(weekly, op.date) && matchesHabit(op.habitDefinitionId),
  );
  if (additions.length === 0 && deletions.length === 0) return weekly;

  return {
    ...weekly,
    days: weekly.days.map((day) => {
      const dayAdditions = additions.filter((p) => p.date === day.date);
      const dayDeletions = deletions.filter((d) => d.date === day.date);
      if (dayAdditions.length === 0 && dayDeletions.length === 0) return day;

      const counts = new Map(day.counts.map((c) => [c.habitDefinitionId, c.count]));
      for (const p of dayAdditions) {
        const current = counts.get(p.habitDefinitionId) ?? 0;
        counts.set(p.habitDefinitionId, current + repCount(p.type, p.data));
      }
      for (const d of dayDeletions) {
        const current = counts.get(d.habitDefinitionId) ?? 0;
        counts.set(d.habitDefinitionId, current - repCount(d.type, d.data));
      }
      const merged: HabitCount[] = [...counts].map(([id, count]) => ({
        habitDefinitionId: id,
        count,
      }));
      return { ...day, counts: merged };
    }),
  };
}
