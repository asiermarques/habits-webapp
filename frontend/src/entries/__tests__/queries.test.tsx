import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { useCreateEntry } from '../queries';
import { getPendingEntries } from '../offlineStore';
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
