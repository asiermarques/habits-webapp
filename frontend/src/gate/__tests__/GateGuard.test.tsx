import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { GateGuard, offlineGraceMs } from '../GateGuard';
import { rememberGate } from '../storage';
import { apiFetch, ApiError } from '@/lib/api';
import { addPendingEntryCreate, getPendingEntries } from '@/entries/offlineStore';

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, apiFetch: vi.fn() };
});

const mockedFetch = vi.mocked(apiFetch);

function renderGuard(children: ReactNode = <div>protected content</div>) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <GateGuard>{children}</GateGuard>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockedFetch.mockReset();
  localStorage.clear();
});

describe('GateGuard', () => {
  it('renders the app when the instance is not gated', async () => {
    mockedFetch.mockImplementation((async (path: string) => {
      if (path === '/auth/status') return { gated: false, authenticated: true };
      return undefined;
    }) as typeof apiFetch);

    renderGuard();

    expect(await screen.findByText('protected content')).toBeInTheDocument();
  });

  it('shows the unlock screen when gated and not yet authenticated', async () => {
    mockedFetch.mockImplementation((async (path: string) => {
      if (path === '/auth/status') return { gated: true, authenticated: false };
      return undefined;
    }) as typeof apiFetch);

    renderGuard();

    expect(await screen.findByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
  });

  it('reveals the app after the correct password is submitted', async () => {
    let authenticated = false;
    mockedFetch.mockImplementation((async (path: string) => {
      if (path === '/auth/status') return { gated: true, authenticated };
      if (path === '/auth/login') {
        authenticated = true;
        return { authenticated: true };
      }
      return undefined;
    }) as typeof apiFetch);

    renderGuard();

    await userEvent.type(await screen.findByLabelText(/password/i), 'open-sesame');
    await userEvent.click(screen.getByRole('button', { name: /unlock/i }));

    expect(await screen.findByText('protected content')).toBeInTheDocument();
  });

  it('shows an inline error when the password is rejected', async () => {
    mockedFetch.mockImplementation((async (path: string) => {
      if (path === '/auth/status') return { gated: true, authenticated: false };
      if (path === '/auth/login') throw new ApiError('Invalid password', 401);
      return undefined;
    }) as typeof apiFetch);

    renderGuard();

    await userEvent.type(await screen.findByLabelText(/password/i), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: /unlock/i }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
  });

  it('opens offline when last authenticated online within the grace window', async () => {
    // Offline: the status call cannot reach the server, but we unlocked recently.
    rememberGate({ gated: true, authenticated: true });
    mockedFetch.mockRejectedValue(new TypeError('Failed to fetch'));

    renderGuard();

    expect(await screen.findByText('protected content')).toBeInTheDocument();
  });

  it('fails closed offline when the last online unlock is older than the grace window', async () => {
    // Stamp the snapshot more than two hours in the past, then read with real time.
    const realNow = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(realNow - (2 * 60 * 60 * 1000 + 1));
    rememberGate({ gated: true, authenticated: true });
    vi.mocked(Date.now).mockRestore();
    mockedFetch.mockRejectedValue(new TypeError('Failed to fetch'));

    renderGuard();

    // Fail closed so cached data isn't shown stale without a fresh unlock.
    expect(await screen.findByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
  });

  it('falls back to the unlock screen offline when last known gated but locked', async () => {
    rememberGate({ gated: true, authenticated: false });
    mockedFetch.mockRejectedValue(new TypeError('Failed to fetch'));

    renderGuard();

    expect(await screen.findByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
  });

  it('renders the app offline when the instance was last known to be open', async () => {
    rememberGate({ gated: false, authenticated: true });
    mockedFetch.mockRejectedValue(new TypeError('Failed to fetch'));

    renderGuard();

    expect(await screen.findByText('protected content')).toBeInTheDocument();
  });

  // US-010 (OQ-002, resolved "hidden but retained"): pending offline changes
  // must survive every re-lock trigger and stay unreachable from the lock
  // screen, without the app ever mounting anything that could read them.
  it('keeps pending changes in storage, and inaccessible, when locked by a 401 gate re-check', async () => {
    addPendingEntryCreate({ userId: 1, habitDefinitionId: 2, type: 'workout', date: '2026-08-01', data: {} });
    mockedFetch.mockImplementation((async (path: string) => {
      if (path === '/auth/status') return { gated: true, authenticated: false };
      return undefined;
    }) as typeof apiFetch);

    renderGuard();

    expect(await screen.findByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
    expect(getPendingEntries()).toHaveLength(1);
  });

  it('keeps pending changes in storage, and inaccessible, when the offline grace window has expired', async () => {
    addPendingEntryCreate({ userId: 1, habitDefinitionId: 2, type: 'workout', date: '2026-08-01', data: {} });
    const realNow = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(realNow - (2 * 60 * 60 * 1000 + 1));
    rememberGate({ gated: true, authenticated: true });
    vi.mocked(Date.now).mockRestore();
    mockedFetch.mockRejectedValue(new TypeError('Failed to fetch'));

    renderGuard();

    expect(await screen.findByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
    expect(getPendingEntries()).toHaveLength(1);
  });

  it('makes pending changes reachable again once the instance is unlocked', async () => {
    addPendingEntryCreate({ userId: 1, habitDefinitionId: 2, type: 'workout', date: '2026-08-01', data: {} });
    let authenticated = false;
    mockedFetch.mockImplementation((async (path: string) => {
      if (path === '/auth/status') return { gated: true, authenticated };
      if (path === '/auth/login') {
        authenticated = true;
        return { authenticated: true };
      }
      return undefined;
    }) as typeof apiFetch);

    renderGuard();
    expect(await screen.findByLabelText(/password/i)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/password/i), 'open-sesame');
    await userEvent.click(screen.getByRole('button', { name: /unlock/i }));

    expect(await screen.findByText('protected content')).toBeInTheDocument();
    expect(getPendingEntries()).toHaveLength(1);
  });

  it('remembers the gate snapshot so a later offline load can decide', async () => {
    mockedFetch.mockImplementation((async (path: string) => {
      if (path === '/auth/status') return { gated: true, authenticated: true };
      return undefined;
    }) as typeof apiFetch);

    renderGuard();

    await screen.findByText('protected content');
    const { lastKnownGate } = await import('../storage');
    expect(lastKnownGate()).toMatchObject({ gated: true, authenticated: true });
  });
});

describe('offlineGraceMs', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to 120 minutes', () => {
    expect(offlineGraceMs()).toBe(120 * 60 * 1000);
  });

  it('reads the window from GATE_OFFLINE_GRACE_MINUTES', () => {
    vi.stubEnv('GATE_OFFLINE_GRACE_MINUTES', '30');
    expect(offlineGraceMs()).toBe(30 * 60 * 1000);
  });

  it('falls back to the default when the env value is non-numeric or non-positive', () => {
    vi.stubEnv('GATE_OFFLINE_GRACE_MINUTES', 'nonsense');
    expect(offlineGraceMs()).toBe(120 * 60 * 1000);
    vi.stubEnv('GATE_OFFLINE_GRACE_MINUTES', '0');
    expect(offlineGraceMs()).toBe(120 * 60 * 1000);
  });
});
