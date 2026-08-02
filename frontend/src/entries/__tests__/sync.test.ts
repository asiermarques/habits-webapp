import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { drainPendingEntries } from '../sync';
import { addPendingEntryCreate, getPendingEntries } from '../offlineStore';
import { apiFetch, OfflineError, ApiError } from '@/lib/api';

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, apiFetch: vi.fn() };
});

const apiFetchMock = vi.mocked(apiFetch);

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe('drainPendingEntries', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    window.localStorage.clear();
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(true);
  });

  it('does nothing when there is nothing pending', async () => {
    const qc = makeQueryClient();
    await drainPendingEntries(qc);
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it('pushes every pending entry and clears the store once all are accepted', async () => {
    addPendingEntryCreate({ userId: 1, habitDefinitionId: 2, type: 'workout', date: '2026-08-01', data: { duration: 30 } });
    addPendingEntryCreate({ userId: 1, habitDefinitionId: 2, type: 'workout', date: '2026-08-02', data: { duration: 45 } });
    apiFetchMock.mockResolvedValue({ id: 99, habitDefinitionId: 2, userId: 1, date: '2026-08-01', createdAt: 'now', type: 'workout', data: {} });

    const qc = makeQueryClient();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    await drainPendingEntries(qc);

    expect(apiFetchMock).toHaveBeenCalledTimes(2);
    expect(getPendingEntries()).toEqual([]);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['entries'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['metrics'] });
  });

  it('sends each pending entry as its own userId, unaffected by which user is active', async () => {
    addPendingEntryCreate({ userId: 7, habitDefinitionId: 2, type: 'workout', date: '2026-08-01', data: { duration: 30 } });
    apiFetchMock.mockResolvedValue({});

    await drainPendingEntries(makeQueryClient());

    expect(apiFetchMock).toHaveBeenCalledWith('/entries', {
      method: 'POST',
      body: { habitDefinitionId: 2, userId: 7, date: '2026-08-01', data: { duration: 30 } },
    });
  });

  it('leaves the entry in the store and stops draining when the network is unreachable', async () => {
    addPendingEntryCreate({ userId: 1, habitDefinitionId: 2, type: 'workout', date: '2026-08-01', data: { duration: 30 } });
    addPendingEntryCreate({ userId: 1, habitDefinitionId: 2, type: 'workout', date: '2026-08-02', data: { duration: 45 } });
    apiFetchMock.mockRejectedValue(new OfflineError());

    await drainPendingEntries(makeQueryClient());

    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(getPendingEntries()).toHaveLength(2);
  });

  it('leaves a server-rejected entry in place but continues draining the rest', async () => {
    addPendingEntryCreate({ userId: 1, habitDefinitionId: 2, type: 'workout', date: '2026-08-01', data: { duration: 30 } });
    addPendingEntryCreate({ userId: 1, habitDefinitionId: 2, type: 'workout', date: '2026-08-02', data: { duration: 45 } });
    apiFetchMock
      .mockRejectedValueOnce(new ApiError('habit definition not found', 404))
      .mockResolvedValueOnce({});

    await drainPendingEntries(makeQueryClient());

    expect(apiFetchMock).toHaveBeenCalledTimes(2);
    const remaining = getPendingEntries();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].date).toBe('2026-08-01');
  });

  it('does not attempt a push at all when the browser reports offline', async () => {
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
    addPendingEntryCreate({ userId: 1, habitDefinitionId: 2, type: 'workout', date: '2026-08-01', data: { duration: 30 } });

    await drainPendingEntries(makeQueryClient());

    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(getPendingEntries()).toHaveLength(1);
  });
});
