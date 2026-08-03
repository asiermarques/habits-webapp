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
import { todayIso } from '@/entries/date';
import { usePendingEntries, usePendingOps } from '@/entries/queries';
import { mergePendingIntoWeekly } from './pendingOverlay';

// Every metrics read is anchored to a calendar day: "this week", "the last N
// days", "today's count". That anchor is part of the identity of the cached
// value, so it belongs in the key — otherwise a session left open across
// midnight keeps serving the previous day's window as if it were current, and
// a long staleTime makes that worse rather than better.
//
// The anchor is the *user's* local day (todayIso), not the server's: entries
// are logged against the local calendar day (see entries/date.ts), so metrics
// must be windowed the same way or an 11:55 PM entry lands outside "this week"
// for users whose offset differs from the server's. The backend already
// accepts `today` on every metrics endpoint; it just was never sent.
export const weeklyMetricsKey = (
  userId: number,
  habitDefinitionId?: number,
  today: string = todayIso(),
) => ['metrics', 'weekly', userId, habitDefinitionId ?? 'all', today] as const;

export const byTypeMetricsKey = (userId: number, today: string = todayIso()) =>
  ['metrics', 'by-type', userId, today] as const;

export const byHabitMetricsKey = (userId: number, today: string = todayIso()) =>
  ['metrics', 'by-habit', userId, today] as const;

export const heatmapMetricsKey = (userId: number, today: string = todayIso()) =>
  ['metrics', 'heatmap', userId, today] as const;

export const summaryMetricsKey = (userId: number, today: string = todayIso()) =>
  ['metrics', 'summary', userId, today] as const;

export function useWeeklyMetrics(userId: number, habitDefinitionId?: number) {
  const today = todayIso();
  const query = useQuery({
    queryKey: weeklyMetricsKey(userId, habitDefinitionId, today),
    enabled: userId > 0,
    queryFn: () => {
      const params = new URLSearchParams({ userId: String(userId), today });
      if (habitDefinitionId !== undefined) {
        params.set('habitDefinitionId', String(habitDefinitionId));
      }
      return apiFetch<WeeklyMetrics>(`/metrics/weekly?${params.toString()}`);
    },
  });
  const pending = usePendingEntries(userId);
  const ops = usePendingOps(userId);

  const data = useMemo(
    () => (query.data ? mergePendingIntoWeekly(query.data, pending, ops, habitDefinitionId) : query.data),
    [query.data, pending, ops, habitDefinitionId],
  );

  return { ...query, data };
}

export function useByTypeMetrics(userId: number) {
  const today = todayIso();
  return useQuery({
    queryKey: byTypeMetricsKey(userId, today),
    enabled: userId > 0,
    queryFn: () =>
      apiFetch<ByTypeMetrics>(`/metrics/by-type?userId=${userId}&today=${today}`),
  });
}

export function useByHabitMetrics(userId: number) {
  const today = todayIso();
  return useQuery({
    queryKey: byHabitMetricsKey(userId, today),
    enabled: userId > 0,
    queryFn: () =>
      apiFetch<ByHabitMetrics>(`/metrics/by-habit?userId=${userId}&today=${today}`),
  });
}

export function useSummaryMetrics(userId: number) {
  const today = todayIso();
  return useQuery({
    queryKey: summaryMetricsKey(userId, today),
    enabled: userId > 0,
    queryFn: () =>
      apiFetch<SummaryMetrics>(`/metrics/summary?userId=${userId}&today=${today}`),
  });
}

export function useHeatmapMetrics(userId: number) {
  const today = todayIso();
  return useQuery({
    queryKey: heatmapMetricsKey(userId, today),
    enabled: userId > 0,
    queryFn: () =>
      apiFetch<HeatmapMetrics>(`/metrics/heatmap?userId=${userId}&today=${today}`),
  });
}
