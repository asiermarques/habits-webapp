import { useQuery } from '@tanstack/react-query';
import type {
  ByHabitMetrics,
  ByTypeMetrics,
  HeatmapMetrics,
  WeeklyMetrics,
} from '@habitsapp/shared';
import { apiFetch } from '@/lib/api';

export const weeklyMetricsKey = (userId: number, habitDefinitionId?: number) =>
  ['metrics', 'weekly', userId, habitDefinitionId ?? 'all'] as const;

export const byTypeMetricsKey = (userId: number) =>
  ['metrics', 'by-type', userId] as const;

export const byHabitMetricsKey = (userId: number) =>
  ['metrics', 'by-habit', userId] as const;

export const heatmapMetricsKey = (userId: number) =>
  ['metrics', 'heatmap', userId] as const;

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

export function useHeatmapMetrics(userId: number) {
  return useQuery({
    queryKey: heatmapMetricsKey(userId),
    enabled: userId > 0,
    queryFn: () =>
      apiFetch<HeatmapMetrics>(`/metrics/heatmap?userId=${userId}`),
  });
}
