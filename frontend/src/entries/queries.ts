import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import type {
  Entry,
  EntryData,
  CreateEntryBody,
} from '@habitsapp/shared';
import { apiFetch, OfflineError } from '@/lib/api';
import {
  addPendingEntryCreate,
  addPendingEntryDelete,
  addPendingEntryUpdate,
  amendPendingEntryCreate,
  getAllPendingEntries,
  getAllPendingOps,
  getPendingEntriesForUser,
  getPendingOpsForUser,
  pendingEntryToEntry,
  removePendingEntry,
  subscribePendingEntries,
} from './offlineStore';
import { useSyncExternalStore } from 'react';
import { habitDefinitionsKey } from '@/habits/queries';

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
  qc.invalidateQueries({ queryKey: ['metrics'] });
}

export function useCreateEntry() {
  const qc = useQueryClient();
  return useMutation({
    // TanStack Query's default networkMode ('online') *pauses* mutations
    // entirely while the browser reports offline — mutationFn never runs, so
    // our own OfflineError handling below would never get a chance to fire.
    // 'always' lets it run unconditionally and treats apiFetch's real
    // fetch() failure as the offline signal instead.
    networkMode: 'always',
    mutationFn: async (body: CreateEntryBody) => {
      try {
        return await apiFetch<Entry>('/entries', { method: 'POST', body });
      } catch (err) {
        if (!(err instanceof OfflineError)) throw err;
        // The request never reached the server: hold it in the durable local
        // store instead (requisites FR-001). addPendingEntryCreate throws on
        // its own if the local write fails, so a create only "succeeds" here
        // once it is actually durable (BR-001).
        const habits = qc.getQueryData<{ id: number; type: Entry['type'] }[]>(
          habitDefinitionsKey(body.userId),
        );
        const type = habits?.find((h) => h.id === body.habitDefinitionId)?.type ?? 'custom';
        const record = addPendingEntryCreate({
          userId: body.userId,
          habitDefinitionId: body.habitDefinitionId,
          type,
          date: body.date,
          data: body.data,
        });
        return pendingEntryToEntry(record);
      }
    },
    // A pending create isn't server data — it's already reflected via the
    // pending-store overlay (usePendingEntries), so invalidating here would
    // just trigger a refetch that fails offline and toasts unnecessarily.
    onSuccess: (entry) => {
      if (entry.id > 0) invalidateEntries(qc);
    },
  });
}

export function usePendingEntries(userId: number) {
  return useSyncExternalStore(
    subscribePendingEntries,
    () => getPendingEntriesForUser(userId),
  );
}

export function usePendingOps(userId: number) {
  return useSyncExternalStore(
    subscribePendingEntries,
    () => getPendingOpsForUser(userId),
  );
}

// Net changes still to push: one per still-pending create, plus one per
// synced Entry with a queued update/delete. Collapse (US-006) keeps this at
// "changes to push", not "user actions taken".
export function usePendingChangesCount() {
  return useSyncExternalStore(
    subscribePendingEntries,
    () => getAllPendingEntries().length + getAllPendingOps().length,
  );
}

type UpdateEntryInput = { id: number; userId: number; date: string; data: EntryData };

export function useUpdateEntry() {
  const qc = useQueryClient();
  return useMutation({
    // See useCreateEntry's comment: 'always' lets the offline branch run.
    networkMode: 'always',
    mutationFn: async ({ id, userId, date, data }: UpdateEntryInput) => {
      // A negative id is a create that hasn't reached the server yet — there
      // is nothing to PUT against, so the queued create is amended in place
      // (US-004's "two genuinely different cases" note).
      if (id < 0) {
        amendPendingEntryCreate(id, { date, data });
        return { synced: false as const };
      }
      try {
        const entry = await apiFetch<Entry>(`/entries/${id}`, { method: 'PUT', body: { date, data } });
        return { synced: true as const, entry };
      } catch (err) {
        if (!(err instanceof OfflineError)) throw err;
        addPendingEntryUpdate({ entryId: id, userId, date, data });
        return { synced: false as const };
      }
    },
    onSuccess: (result) => {
      if (result.synced) invalidateEntries(qc);
    },
  });
}

export function useDeleteEntry() {
  const qc = useQueryClient();
  return useMutation({
    networkMode: 'always',
    mutationFn: async (entry: Entry) => {
      // A negative id is a still-pending create: deleting it removes the
      // queued create outright, nothing to send (US-005).
      if (entry.id < 0) {
        removePendingEntry(entry.id);
        return { synced: false as const };
      }
      try {
        await apiFetch<void>(`/entries/${entry.id}`, { method: 'DELETE' });
        return { synced: true as const };
      } catch (err) {
        if (!(err instanceof OfflineError)) throw err;
        addPendingEntryDelete({
          entryId: entry.id,
          userId: entry.userId,
          habitDefinitionId: entry.habitDefinitionId,
          type: entry.type,
          date: entry.date,
          data: entry.data,
        });
        return { synced: false as const };
      }
    },
    onSuccess: (result) => {
      if (result.synced) invalidateEntries(qc);
    },
  });
}
