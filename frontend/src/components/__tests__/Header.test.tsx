import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Header } from '../Header';
import { TestProviders } from '@/test/test-utils';

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Header', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse([])));
  });

  it('shows the app title and nav icons on home', async () => {
    render(
      <TestProviders initialPath="/">
        <Header />
      </TestProviders>,
    );

    expect(screen.getByText('Habits')).toBeInTheDocument();
    expect(screen.getByLabelText('Metrics')).toBeInTheDocument();
    expect(screen.getByLabelText('Settings')).toBeInTheDocument();
    expect(screen.queryByLabelText('Back to home')).not.toBeInTheDocument();
  });

  it('shows the back arrow on non-home routes', async () => {
    render(
      <TestProviders initialPath="/metrics">
        <Header />
      </TestProviders>,
    );

    expect(screen.getByLabelText('Back to home')).toBeInTheDocument();
    expect(screen.queryByLabelText('Metrics')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Settings')).not.toBeInTheDocument();
  });

  it('hides the user switcher when there are zero or one users', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse([{ id: 1, name: 'Alice', isDefault: true, createdAt: 'now' }]),
      ),
    );

    render(
      <TestProviders initialPath="/">
        <Header />
      </TestProviders>,
    );

    await waitFor(() => expect(screen.queryByLabelText('Switch user')).not.toBeInTheDocument());
  });

  it('shows the user switcher when there are multiple users', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse([
          { id: 1, name: 'Alice', isDefault: true, createdAt: 'now' },
          { id: 2, name: 'Bob', isDefault: false, createdAt: 'now' },
        ]),
      ),
    );

    render(
      <TestProviders initialPath="/">
        <Header />
      </TestProviders>,
    );

    await waitFor(() => expect(screen.getByLabelText('Switch user')).toBeInTheDocument());
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });
});
