import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AppSettings, CurrencyCode, LocaleCode } from '@habitsapp/shared';
import { apiFetch } from '@/lib/api';

export const settingsKey = ['settings'] as const;

export function useSettingsQuery() {
  return useQuery({
    queryKey: settingsKey,
    queryFn: () => apiFetch<AppSettings>('/settings'),
  });
}

export function useUpdateCurrency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (currency: CurrencyCode) =>
      apiFetch<AppSettings>('/settings/currency', {
        method: 'PUT',
        body: { currency },
      }),
    onSuccess: (data) => qc.setQueryData(settingsKey, data),
  });
}

export function useUpdateLocale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (locale: LocaleCode) =>
      apiFetch<AppSettings>('/settings/locale', {
        method: 'PUT',
        body: { locale },
      }),
    onSuccess: (data) => qc.setQueryData(settingsKey, data),
  });
}
