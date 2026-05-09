import { useQuery } from '@tanstack/react-query';
import type { WeeklyMetrics } from '@habitsapp/shared';
import { apiFetch } from '@/lib/api';

export const weeklyMetricsKey = (userId: number, habitDefinitionId?: number) =>
  ['metrics', 'weekly', userId, habitDefinitionId ?? 'all'] as const;

export function useWeeklyMetrics(userId: number, habitDefinitionId?: number) {
  return useQuery({
    queryKey: weeklyMetricsKey(userId, habitDefinitionId),
    enabled: userId > 0,
    queryFn: () => {
      const params = new URLSearchParams({ userId: String(userId) });
      if (habitDefinitionId !== undefined) {
        params.set('habitDefinitionId', String(habitDefinitionId));
      }
      return apiFetch<WeeklyMetrics>(`/metrics/weekly?${params.toString()}`);
    },
  });
}
