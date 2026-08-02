import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EntrySync } from '../EntrySync';
import { addPendingEntryCreate } from '../offlineStore';
import { apiFetch } from '@/lib/api';

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, apiFetch: vi.fn() };
});

const apiFetchMock = vi.mocked(apiFetch);

function renderWithClient() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <EntrySync />
    </QueryClientProvider>,
  );
}

describe('EntrySync', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchMock.mockResolvedValue({});
    window.localStorage.clear();
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('drains pending entries once on mount when already online', async () => {
    addPendingEntryCreate({ userId: 1, habitDefinitionId: 2, type: 'workout', date: '2026-08-01', data: { duration: 30 } });

    renderWithClient();

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));
  });

  it('drains again when the browser transitions to online', async () => {
    renderWithClient();
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(0));

    addPendingEntryCreate({ userId: 1, habitDefinitionId: 2, type: 'workout', date: '2026-08-01', data: { duration: 30 } });
    window.dispatchEvent(new Event('online'));

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));
  });

  it('drains periodically while mounted', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    addPendingEntryCreate({ userId: 1, habitDefinitionId: 2, type: 'workout', date: '2026-08-01', data: { duration: 30 } });

    renderWithClient();
    await vi.waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));

    addPendingEntryCreate({ userId: 1, habitDefinitionId: 3, type: 'workout', date: '2026-08-02', data: { duration: 30 } });
    await vi.advanceTimersByTimeAsync(31_000);

    expect(apiFetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
