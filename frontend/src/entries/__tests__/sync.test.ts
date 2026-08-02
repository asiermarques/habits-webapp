import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { drainPendingEntries } from '../sync';
import {
  addPendingEntryCreate,
  addPendingEntryUpdate,
  addPendingEntryDelete,
  getPendingEntries,
  getPendingOps,
} from '../offlineStore';
import { recordDrainSuccess, isSyncFailing } from '../syncStatus';
import { gateKey } from '@/gate/queries';
import { apiFetch, OfflineError, ApiError } from '@/lib/api';

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, apiFetch: vi.fn() };
});

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const apiFetchMock = vi.mocked(apiFetch);

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe('drainPendingEntries', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    vi.mocked(toast.error).mockReset();
    window.localStorage.clear();
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(true);
    recordDrainSuccess(); // reset any failure streak left over from a previous test
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

  it('leaves a transiently-failed entry in place but continues draining the rest', async () => {
    addPendingEntryCreate({ userId: 1, habitDefinitionId: 2, type: 'workout', date: '2026-08-01', data: { duration: 30 } });
    addPendingEntryCreate({ userId: 1, habitDefinitionId: 2, type: 'workout', date: '2026-08-02', data: { duration: 45 } });
    apiFetchMock
      .mockRejectedValueOnce(new ApiError('internal error', 500))
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

  it('pushes a queued update via PUT and clears it once accepted', async () => {
    addPendingEntryUpdate({ entryId: 10, userId: 1, date: '2026-08-02', data: { duration: 45 } });
    apiFetchMock.mockResolvedValue({});

    const qc = makeQueryClient();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    await drainPendingEntries(qc);

    expect(apiFetchMock).toHaveBeenCalledWith('/entries/10', {
      method: 'PUT',
      body: { date: '2026-08-02', data: { duration: 45 } },
    });
    expect(getPendingOps()).toEqual([]);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['entries'] });
  });

  it('pushes a queued delete via DELETE and clears it once accepted', async () => {
    addPendingEntryDelete({
      entryId: 10,
      userId: 1,
      habitDefinitionId: 2,
      type: 'workout',
      date: '2026-08-01',
      data: { duration: 30 },
    });
    apiFetchMock.mockResolvedValue(undefined);

    await drainPendingEntries(makeQueryClient());

    expect(apiFetchMock).toHaveBeenCalledWith('/entries/10', { method: 'DELETE' });
    expect(getPendingOps()).toEqual([]);
  });

  it('leaves a queued op in place and stops draining when the network drops mid-drain', async () => {
    addPendingEntryUpdate({ entryId: 10, userId: 1, date: '2026-08-02', data: { duration: 45 } });
    addPendingEntryUpdate({ entryId: 11, userId: 1, date: '2026-08-03', data: { duration: 60 } });
    apiFetchMock.mockRejectedValue(new OfflineError());

    await drainPendingEntries(makeQueryClient());

    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(getPendingOps()).toHaveLength(2);
  });

  it('leaves a transiently-failed op in place but continues draining the rest', async () => {
    addPendingEntryUpdate({ entryId: 10, userId: 1, date: '2026-08-02', data: { duration: 45 } });
    addPendingEntryUpdate({ entryId: 11, userId: 1, date: '2026-08-03', data: { duration: 60 } });
    apiFetchMock
      .mockRejectedValueOnce(new ApiError('internal error', 500))
      .mockResolvedValueOnce({});

    await drainPendingEntries(makeQueryClient());

    expect(apiFetchMock).toHaveBeenCalledTimes(2);
    const remaining = getPendingOps();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].entryId).toBe(10);
  });

  it('does not touch the failure streak when the network is unreachable (US-007)', async () => {
    addPendingEntryCreate({ userId: 1, habitDefinitionId: 2, type: 'workout', date: '2026-08-01', data: { duration: 30 } });
    apiFetchMock.mockRejectedValue(new OfflineError());

    await drainPendingEntries(makeQueryClient());

    expect(isSyncFailing()).toBe(false);
  });

  it('does not flip to failing after a single transient server error', async () => {
    addPendingEntryCreate({ userId: 1, habitDefinitionId: 2, type: 'workout', date: '2026-08-01', data: { duration: 30 } });
    apiFetchMock.mockRejectedValue(new ApiError('internal error', 500));

    await drainPendingEntries(makeQueryClient());

    expect(isSyncFailing()).toBe(false);
  });

  it('flips to failing after repeated transient server errors against restored connectivity', async () => {
    addPendingEntryCreate({ userId: 1, habitDefinitionId: 2, type: 'workout', date: '2026-08-01', data: { duration: 30 } });
    apiFetchMock.mockRejectedValue(new ApiError('internal error', 500));

    const qc = makeQueryClient();
    await drainPendingEntries(qc);
    await drainPendingEntries(qc);
    await drainPendingEntries(qc);

    expect(isSyncFailing()).toBe(true);
  });

  it('clears the failing state once a retry succeeds', async () => {
    addPendingEntryCreate({ userId: 1, habitDefinitionId: 2, type: 'workout', date: '2026-08-01', data: { duration: 30 } });
    apiFetchMock.mockRejectedValue(new ApiError('internal error', 500));
    const qc = makeQueryClient();
    await drainPendingEntries(qc);
    await drainPendingEntries(qc);
    await drainPendingEntries(qc);
    expect(isSyncFailing()).toBe(true);

    apiFetchMock.mockResolvedValue({});
    await drainPendingEntries(qc);

    expect(isSyncFailing()).toBe(false);
    expect(getPendingEntries()).toEqual([]);
  });

  it('discards a pending create the server rejects on its merits (4xx) and notifies the user (US-008)', async () => {
    addPendingEntryCreate({ userId: 1, habitDefinitionId: 2, type: 'workout', date: '2026-08-01', data: { duration: 30 } });
    apiFetchMock.mockRejectedValue(new ApiError('Habit definition not found', 404));

    await drainPendingEntries(makeQueryClient());

    expect(getPendingEntries()).toEqual([]);
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(vi.mocked(toast.error).mock.calls[0][0]).toContain('Habit definition not found');
  });

  it('discards a pending op the server rejects on its merits (4xx) and notifies the user', async () => {
    addPendingEntryUpdate({ entryId: 10, userId: 1, date: '2026-08-02', data: { duration: 45 } });
    apiFetchMock.mockRejectedValue(new ApiError('forbidden', 403));

    await drainPendingEntries(makeQueryClient());

    expect(getPendingOps()).toEqual([]);
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it('does not count a discarded 4xx rejection towards the failure streak', async () => {
    addPendingEntryCreate({ userId: 1, habitDefinitionId: 2, type: 'workout', date: '2026-08-01', data: { duration: 30 } });
    apiFetchMock.mockRejectedValue(new ApiError('Habit definition not found', 404));

    const qc = makeQueryClient();
    await drainPendingEntries(qc);
    await drainPendingEntries(qc);
    await drainPendingEntries(qc);

    expect(isSyncFailing()).toBe(false);
  });

  it('does not let one rejected create block the rest of the backlog from draining', async () => {
    addPendingEntryCreate({ userId: 1, habitDefinitionId: 2, type: 'workout', date: '2026-08-01', data: { duration: 30 } });
    addPendingEntryCreate({ userId: 1, habitDefinitionId: 2, type: 'workout', date: '2026-08-02', data: { duration: 45 } });
    apiFetchMock
      .mockRejectedValueOnce(new ApiError('Habit definition not found', 404))
      .mockResolvedValueOnce({});

    await drainPendingEntries(makeQueryClient());

    expect(getPendingEntries()).toEqual([]);
  });

  it('routes a 401 mid-drain into a gate re-check instead of discarding or failing', async () => {
    addPendingEntryCreate({ userId: 1, habitDefinitionId: 2, type: 'workout', date: '2026-08-01', data: { duration: 30 } });
    addPendingEntryCreate({ userId: 1, habitDefinitionId: 2, type: 'workout', date: '2026-08-02', data: { duration: 45 } });
    apiFetchMock.mockRejectedValue(new ApiError('unauthenticated', 401));

    const qc = makeQueryClient();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    await drainPendingEntries(qc);

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: gateKey() });
    expect(apiFetchMock).toHaveBeenCalledTimes(1); // stopped draining, like OfflineError
    expect(getPendingEntries()).toHaveLength(2); // left in place, not discarded
    expect(toast.error).not.toHaveBeenCalled();
    expect(isSyncFailing()).toBe(false);
  });

  it('pushes creates before ops', async () => {
    addPendingEntryUpdate({ entryId: 10, userId: 1, date: '2026-08-02', data: { duration: 45 } });
    addPendingEntryCreate({ userId: 1, habitDefinitionId: 2, type: 'workout', date: '2026-08-01', data: { duration: 30 } });
    apiFetchMock.mockResolvedValue({});

    await drainPendingEntries(makeQueryClient());

    expect(apiFetchMock.mock.calls[0][1]?.method).toBe('POST');
    expect(apiFetchMock.mock.calls[1][1]?.method).toBe('PUT');
  });
});
