import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import type {
  Entry,
  CreateEntryBody,
  UpdateEntryBody,
} from '@habitsapp/shared';
import { apiFetch } from '@/lib/api';

export type EntriesPageResponse = {
  items: Entry[];
  nextCursor: string | null;
};

export const entriesKey = (userId: number, habitDefinitionId?: number) =>
  ['entries', userId, habitDefinitionId ?? 'all'] as const;

type Filters = { userId: number; habitDefinitionId?: number };

export function useEntriesInfinite({ userId, habitDefinitionId }: Filters) {
  return useInfiniteQuery({
    queryKey: entriesKey(userId, habitDefinitionId),
    enabled: userId > 0,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams();
      params.set('userId', String(userId));
      if (habitDefinitionId !== undefined) {
        params.set('habitDefinitionId', String(habitDefinitionId));
      }
      if (pageParam) params.set('cursor', pageParam);
      return apiFetch<EntriesPageResponse>(`/entries?${params.toString()}`);
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}

function invalidateEntries(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['entries'] });
}

export function useCreateEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateEntryBody) =>
      apiFetch<Entry>('/entries', { method: 'POST', body }),
    onSuccess: () => invalidateEntries(qc),
  });
}

export function useUpdateEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateEntryBody & { id: number }) =>
      apiFetch<Entry>(`/entries/${id}`, { method: 'PUT', body }),
    onSuccess: () => invalidateEntries(qc),
  });
}

export function useDeleteEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiFetch<void>(`/entries/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateEntries(qc),
  });
}
