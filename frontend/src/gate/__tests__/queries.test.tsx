import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useGateLogout } from '../queries';
import { addPendingEntryCreate, getPendingEntries } from '@/entries/offlineStore';
import { apiFetch } from '@/lib/api';

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, apiFetch: vi.fn() };
});

const apiFetchMock = vi.mocked(apiFetch);

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useGateLogout', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchMock.mockResolvedValue({ authenticated: false });
    window.localStorage.clear();
  });

  // US-010 (OQ-002, resolved "hidden but retained"): logout must not destroy
  // unsynced local changes, only re-lock access to them.
  it('does not evict pending offline changes on logout', async () => {
    addPendingEntryCreate({ userId: 1, habitDefinitionId: 2, type: 'workout', date: '2026-08-01', data: {} });

    const { result } = renderHook(() => useGateLogout(), { wrapper });
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getPendingEntries()).toHaveLength(1);
  });
});
