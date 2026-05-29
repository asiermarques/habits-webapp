import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { GateGuard } from '../GateGuard';
import { rememberGated } from '../storage';
import { apiFetch, ApiError } from '@/lib/api';

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

  it('falls back to the unlock screen offline when the instance was last known to be gated', async () => {
    // Offline: the status call cannot reach the server.
    rememberGated(true);
    mockedFetch.mockRejectedValue(new TypeError('Failed to fetch'));

    renderGuard();

    // Fail closed so service-worker-cached data is never shown without a fresh unlock.
    expect(await screen.findByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
  });

  it('renders the app offline when the instance was last known to be open', async () => {
    rememberGated(false);
    mockedFetch.mockRejectedValue(new TypeError('Failed to fetch'));

    renderGuard();

    expect(await screen.findByText('protected content')).toBeInTheDocument();
  });

  it('remembers the gated flag so a later offline load can fail closed', async () => {
    mockedFetch.mockImplementation((async (path: string) => {
      if (path === '/auth/status') return { gated: true, authenticated: true };
      return undefined;
    }) as typeof apiFetch);

    renderGuard();

    await screen.findByText('protected content');
    const { wasGated } = await import('../storage');
    expect(wasGated()).toBe(true);
  });
});
