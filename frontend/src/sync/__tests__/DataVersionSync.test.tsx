import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { DataVersionSync } from '../DataVersionSync';
import { forgetDataVersion } from '../dataVersion';
import { apiFetch } from '@/lib/api';

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, apiFetch: vi.fn() };
});

// The component reads only `activeUser` from the context; stubbing the module
// keeps the test off the /users request UserProvider would otherwise make.
vi.mock('@/users/UserContext', () => ({
  useUserContext: () => ({
    users: [],
    activeUser: activeUser.current,
    setActiveUserId: () => {},
    isLoading: false,
  }),
  UserProvider: ({ children }: { children: ReactNode }) => children,
}));

const activeUser = { current: undefined as { id: number } | undefined };
const apiFetchMock = vi.mocked(apiFetch);

function renderWithClient() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <DataVersionSync />
    </QueryClientProvider>,
  );
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
}

describe('DataVersionSync', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchMock.mockResolvedValue({ version: '1.0' });
    forgetDataVersion();
    activeUser.current = { id: 1 };
    setVisibility('visible');
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('checks the version once on mount', async () => {
    renderWithClient();

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));
  });

  it('checks nothing until a user is selected', async () => {
    activeUser.current = undefined;

    renderWithClient();

    await waitFor(() => expect(apiFetchMock).not.toHaveBeenCalled());
  });

  // The event that matters on a phone: returning to an installed PWA remounts
  // nothing and reconnects nothing, so nothing else would prompt a check.
  it('checks again when the app returns to the foreground', async () => {
    renderWithClient();
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));

    document.dispatchEvent(new Event('visibilitychange'));

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(2));
  });

  it('ignores a visibility change that hides the app', async () => {
    renderWithClient();
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));

    setVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));
  });

  it('checks again when the browser comes back online', async () => {
    renderWithClient();
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));

    window.dispatchEvent(new Event('online'));

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(2));
  });

  it('polls while the app is in the foreground', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderWithClient();
    await vi.waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));

    await vi.advanceTimersByTimeAsync(61_000);

    expect(apiFetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  // A backgrounded tab costs nothing; the foreground transition catches it up.
  it('does not poll while the app is in the background', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderWithClient();
    await vi.waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));

    setVisibility('hidden');
    await vi.advanceTimersByTimeAsync(181_000);

    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });
});
