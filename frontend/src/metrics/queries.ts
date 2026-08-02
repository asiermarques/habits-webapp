import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type {
  ByHabitMetrics,
  ByTypeMetrics,
  HeatmapMetrics,
  SummaryMetrics,
  WeeklyMetrics,
} from '@habitsapp/shared';
import { apiFetch } from '@/lib/api';
import { usePendingEntries } from '@/entries/queries';
import { mergePendingIntoWeekly } from './pendingOverlay';

export const weeklyMetricsKey = (userId: number, habitDefinitionId?: number) =>
  ['metrics', 'weekly', userId, habitDefinitionId ?? 'all'] as const;

export const byTypeMetricsKey = (userId: number) =>
  ['metrics', 'by-type', userId] as const;

export const byHabitMetricsKey = (userId: number) =>
  ['metrics', 'by-habit', userId] as const;

export const heatmapMetricsKey = (userId: number) =>
  ['metrics', 'heatmap', userId] as const;

export const summaryMetricsKey = (userId: number) =>
  ['metrics', 'summary', userId] as const;

export function useWeeklyMetrics(userId: number, habitDefinitionId?: number) {
  const query = useQuery({
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
  const pending = usePendingEntries(userId);

  const data = useMemo(
    () => (query.data ? mergePendingIntoWeekly(query.data, pending, habitDefinitionId) : query.data),
    [query.data, pending, habitDefinitionId],
  );

  return { ...query, data };
}

export function useByTypeMetrics(userId: number) {
  return useQuery({
    queryKey: byTypeMetricsKey(userId),
    enabled: userId > 0,
    queryFn: () =>
      apiFetch<ByTypeMetrics>(`/metrics/by-type?userId=${userId}`),
  });
}

export function useByHabitMetrics(userId: number) {
  return useQuery({
    queryKey: byHabitMetricsKey(userId),
    enabled: userId > 0,
    queryFn: () =>
      apiFetch<ByHabitMetrics>(`/metrics/by-habit?userId=${userId}`),
  });
}

export function useSummaryMetrics(userId: number) {
  return useQuery({
    queryKey: summaryMetricsKey(userId),
    enabled: userId > 0,
    queryFn: () =>
      apiFetch<SummaryMetrics>(`/metrics/summary?userId=${userId}`),
  });
}

export function useHeatmapMetrics(userId: number) {
  return useQuery({
    queryKey: heatmapMetricsKey(userId),
    enabled: userId > 0,
    queryFn: () =>
      apiFetch<HeatmapMetrics>(`/metrics/heatmap?userId=${userId}`),
  });
}
