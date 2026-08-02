import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { Entry } from '@habitsapp/shared';
import { useCreateEntry, useUpdateEntry, useDeleteEntry, usePendingChangesCount } from '../queries';
import {
  addPendingEntryCreate,
  getPendingEntries,
  getPendingOps,
} from '../offlineStore';
import { makeQueryClient } from '@/test/test-utils';
import { apiFetch, OfflineError } from '@/lib/api';

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    apiFetch: vi.fn(),
  };
});

const apiFetchMock = vi.mocked(apiFetch);

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = makeQueryClient();
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useCreateEntry offline behaviour', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    window.localStorage.clear();
  });

  it('creates the entry through the API when online', async () => {
    apiFetchMock.mockResolvedValueOnce({ id: 1, habitDefinitionId: 2, userId: 3, date: '2026-08-01', createdAt: 'now', type: 'workout', data: { duration: 30 } });

    const { result } = renderHook(() => useCreateEntry(), { wrapper });
    result.current.mutate({ habitDefinitionId: 2, userId: 3, date: '2026-08-01', data: { duration: 30 } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getPendingEntries()).toEqual([]);
  });

  it('stores the entry locally and still succeeds when the network is unreachable', async () => {
    apiFetchMock.mockRejectedValueOnce(new OfflineError());

    const { result } = renderHook(() => useCreateEntry(), { wrapper });
    result.current.mutate({ habitDefinitionId: 2, userId: 3, date: '2026-08-01', data: { duration: 30 } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const pending = getPendingEntries();
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ userId: 3, habitDefinitionId: 2, date: '2026-08-01', data: { duration: 30 } });
  });

  it('fails the mutation when the local write itself fails, instead of reporting success', async () => {
    apiFetchMock.mockRejectedValueOnce(new OfflineError());
    const setItem = vi.spyOn(window.localStorage.__proto__, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });

    const { result } = renderHook(() => useCreateEntry(), { wrapper });
    result.current.mutate({ habitDefinitionId: 2, userId: 3, date: '2026-08-01', data: { duration: 30 } });

    await waitFor(() => expect(result.current.isError).toBe(true));

    setItem.mockRestore();
  });
});

const syncedEntry: Entry = {
  id: 10,
  habitDefinitionId: 2,
  userId: 3,
  date: '2026-08-01',
  createdAt: 'now',
  type: 'workout',
  data: { duration: 30 },
};

describe('useUpdateEntry offline behaviour', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    window.localStorage.clear();
  });

  it('updates through the API when online', async () => {
    apiFetchMock.mockResolvedValueOnce({ ...syncedEntry, data: { duration: 45 } });

    const { result } = renderHook(() => useUpdateEntry(), { wrapper });
    result.current.mutate({ id: 10, userId: 3, date: '2026-08-01', data: { duration: 45 } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getPendingOps()).toEqual([]);
  });

  it('queues an update against a synced Entry when the network is unreachable', async () => {
    apiFetchMock.mockRejectedValueOnce(new OfflineError());

    const { result } = renderHook(() => useUpdateEntry(), { wrapper });
    result.current.mutate({ id: 10, userId: 3, date: '2026-08-02', data: { duration: 45 } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const ops = getPendingOps();
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ kind: 'update', entryId: 10, date: '2026-08-02', data: { duration: 45 } });
  });

  it('amends a still-pending create in place instead of calling the API at all', async () => {
    const pending = addPendingEntryCreate({
      userId: 3,
      habitDefinitionId: 2,
      type: 'workout',
      date: '2026-08-01',
      data: { duration: 30 },
    });

    const { result } = renderHook(() => useUpdateEntry(), { wrapper });
    result.current.mutate({ id: pending.localId, userId: 3, date: '2026-08-02', data: { duration: 60 } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(getPendingEntries()).toEqual([
      { ...pending, date: '2026-08-02', data: { duration: 60 } },
    ]);
  });
});

describe('useDeleteEntry offline behaviour', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    window.localStorage.clear();
  });

  it('deletes through the API when online', async () => {
    apiFetchMock.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useDeleteEntry(), { wrapper });
    result.current.mutate(syncedEntry);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getPendingOps()).toEqual([]);
  });

  it('queues a delete against a synced Entry when the network is unreachable', async () => {
    apiFetchMock.mockRejectedValueOnce(new OfflineError());

    const { result } = renderHook(() => useDeleteEntry(), { wrapper });
    result.current.mutate(syncedEntry);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const ops = getPendingOps();
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({
      kind: 'delete',
      entryId: 10,
      habitDefinitionId: 2,
      type: 'workout',
      date: '2026-08-01',
      data: { duration: 30 },
    });
  });

  it('removes a still-pending create outright instead of queuing anything', async () => {
    const pending = addPendingEntryCreate({
      userId: 3,
      habitDefinitionId: 2,
      type: 'workout',
      date: '2026-08-01',
      data: { duration: 30 },
    });
    const pendingAsEntry: Entry = {
      id: pending.localId,
      habitDefinitionId: pending.habitDefinitionId,
      userId: pending.userId,
      date: pending.date,
      createdAt: pending.createdAt,
      type: pending.type,
      data: pending.data,
    };

    const { result } = renderHook(() => useDeleteEntry(), { wrapper });
    result.current.mutate(pendingAsEntry);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(getPendingEntries()).toEqual([]);
    expect(getPendingOps()).toEqual([]);
  });
});

describe('US-006 collapse across the mutation hooks', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    window.localStorage.clear();
  });

  it('create, edit twice, delete offline leaves nothing pending and nothing to push on reconnect', async () => {
    apiFetchMock.mockRejectedValue(new OfflineError());

    const create = renderHook(() => useCreateEntry(), { wrapper });
    create.result.current.mutate({ habitDefinitionId: 2, userId: 3, date: '2026-08-01', data: { duration: 30 } });
    await waitFor(() => expect(create.result.current.isSuccess).toBe(true));
    const localId = create.result.current.data!.id;

    const update = renderHook(() => useUpdateEntry(), { wrapper });
    update.result.current.mutate({ id: localId, userId: 3, date: '2026-08-02', data: { duration: 45 } });
    await waitFor(() => expect(update.result.current.isSuccess).toBe(true));
    update.result.current.mutate({ id: localId, userId: 3, date: '2026-08-03', data: { duration: 60 } });
    await waitFor(() => expect(update.result.current.isSuccess).toBe(true));

    const del = renderHook(() => useDeleteEntry(), { wrapper });
    del.result.current.mutate({
      id: localId,
      habitDefinitionId: 2,
      userId: 3,
      date: '2026-08-03',
      createdAt: 'now',
      type: 'workout',
      data: { duration: 60 },
    });
    await waitFor(() => expect(del.result.current.isSuccess).toBe(true));

    expect(getPendingEntries()).toEqual([]);
    expect(getPendingOps()).toEqual([]);

    const count = renderHook(() => usePendingChangesCount(), { wrapper });
    expect(count.result.current).toBe(0);
  });

  it('editing a synced Entry three times queues exactly one update carrying the final values', async () => {
    apiFetchMock.mockRejectedValue(new OfflineError());

    const update = renderHook(() => useUpdateEntry(), { wrapper });
    update.result.current.mutate({ id: 10, userId: 3, date: '2026-08-01', data: { duration: 10 } });
    await waitFor(() => expect(update.result.current.isSuccess).toBe(true));
    update.result.current.mutate({ id: 10, userId: 3, date: '2026-08-02', data: { duration: 20 } });
    await waitFor(() => expect(update.result.current.isSuccess).toBe(true));
    update.result.current.mutate({ id: 10, userId: 3, date: '2026-08-03', data: { duration: 30 } });
    await waitFor(() => expect(update.result.current.isSuccess).toBe(true));

    const ops = getPendingOps();
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ entryId: 10, date: '2026-08-03', data: { duration: 30 } });
  });
});
