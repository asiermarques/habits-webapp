import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { HabitDefinition, User } from '@habitsapp/shared';
import { Header } from '../Header';
import { addPendingEntryCreate } from '@/entries/offlineStore';
import { recordDrainFailure, recordDrainSuccess } from '@/entries/syncStatus';
import { TestProviders } from '@/test/test-utils';

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

const aUser: User = { id: 1, name: 'Alice', isDefault: true, createdAt: 'now' };
const bUser: User = { id: 2, name: 'Bob', isDefault: false, createdAt: 'now' };
const aHabit: HabitDefinition = {
  id: 10, userId: 1, name: 'Reading', type: 'custom', positive: true,
  color: '#3b82f6', createdAt: 'now', hasEntries: false,
};

function stubFetch({ users, habits }: { users: User[]; habits: HabitDefinition[] }) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((input: string) => {
      if (input.endsWith('/users')) return Promise.resolve(jsonResponse(users));
      if (input.includes('/habit-definitions')) return Promise.resolve(jsonResponse(habits));
      return Promise.resolve(jsonResponse([]));
    }),
  );
}

describe('Header', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    stubFetch({ users: [], habits: [] });
    recordDrainSuccess(); // reset any failure streak left over from a previous test
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(true);
  });

  it('shows the app title and nav icons on home', async () => {
    render(
      <TestProviders initialPath="/">
        <Header />
      </TestProviders>,
    );

    expect(screen.getByText('Habits')).toBeInTheDocument();
    expect(screen.getByLabelText('Log entry')).toBeInTheDocument();
    expect(screen.getByLabelText('Metrics')).toBeInTheDocument();
    expect(screen.getByLabelText('Settings')).toBeInTheDocument();
    expect(screen.queryByLabelText('Back to home')).not.toBeInTheDocument();
  });

  it('shows the back arrow and the settings gear on the metrics route', async () => {
    render(
      <TestProviders initialPath="/metrics">
        <Header />
      </TestProviders>,
    );

    expect(screen.getByLabelText('Back to home')).toBeInTheDocument();
    expect(screen.getByLabelText('Log entry')).toBeInTheDocument();
    expect(screen.getByLabelText('Settings')).toBeInTheDocument();
    // The link to the current page is omitted.
    expect(screen.queryByLabelText('Metrics')).not.toBeInTheDocument();
  });

  it('hides the nav icons on routes without navigation', async () => {
    render(
      <TestProviders initialPath="/settings">
        <Header />
      </TestProviders>,
    );

    expect(screen.getByLabelText('Back to home')).toBeInTheDocument();
    expect(screen.queryByLabelText('Log entry')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Metrics')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Settings')).not.toBeInTheDocument();
  });

  it('disables the Log icon when there are no habits', async () => {
    stubFetch({ users: [aUser], habits: [] });

    render(
      <TestProviders initialPath="/">
        <Header />
      </TestProviders>,
    );

    await waitFor(() => expect(screen.getByLabelText('Log entry')).toBeDisabled());
  });

  it('disables the Log icon when there is no active user', async () => {
    stubFetch({ users: [], habits: [aHabit] });

    render(
      <TestProviders initialPath="/">
        <Header />
      </TestProviders>,
    );

    expect(screen.getByLabelText('Log entry')).toBeDisabled();
  });

  it('opens the log dialog when the icon is clicked', async () => {
    stubFetch({ users: [aUser], habits: [aHabit] });
    const user = userEvent.setup();

    render(
      <TestProviders initialPath="/">
        <Header />
      </TestProviders>,
    );

    await waitFor(() => expect(screen.getByLabelText('Log entry')).not.toBeDisabled());

    await user.click(screen.getByLabelText('Log entry'));

    // The lifted dialog renders inside the provider; assert by its title.
    await waitFor(() =>
      expect(screen.getByRole('dialog')).toHaveTextContent('Log entry'),
    );
  });

  it('hides the user switcher when there are zero or one users', async () => {
    stubFetch({ users: [aUser], habits: [] });

    render(
      <TestProviders initialPath="/">
        <Header />
      </TestProviders>,
    );

    await waitFor(() => expect(screen.queryByLabelText('Switch user')).not.toBeInTheDocument());
  });

  it('shows the user switcher when there are multiple users', async () => {
    stubFetch({ users: [aUser, bUser], habits: [] });

    render(
      <TestProviders initialPath="/">
        <Header />
      </TestProviders>,
    );

    await waitFor(() => expect(screen.getByLabelText('Switch user')).toBeInTheDocument());
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('shows no pending indicator when nothing is pending', () => {
    render(
      <TestProviders initialPath="/">
        <Header />
      </TestProviders>,
    );

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows how many changes are pending, and it survives the back-arrow route', async () => {
    addPendingEntryCreate({ userId: 1, habitDefinitionId: 10, type: 'custom', date: '2026-08-01', data: {} });
    addPendingEntryCreate({ userId: 1, habitDefinitionId: 10, type: 'custom', date: '2026-08-02', data: {} });
    addPendingEntryCreate({ userId: 1, habitDefinitionId: 10, type: 'custom', date: '2026-08-03', data: {} });

    render(
      <TestProviders initialPath="/settings">
        <Header />
      </TestProviders>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('3');
    // Doesn't crowd out the still-required back arrow on a non-nav route.
    expect(screen.getByLabelText('Back to home')).toBeInTheDocument();
  });

  it('shows a failing state with a manual retry once sync has failed repeatedly (US-007)', () => {
    addPendingEntryCreate({ userId: 1, habitDefinitionId: 10, type: 'custom', date: '2026-08-01', data: {} });
    recordDrainFailure();
    recordDrainFailure();
    recordDrainFailure();

    render(
      <TestProviders initialPath="/">
        <Header />
      </TestProviders>,
    );

    expect(screen.getByRole('status')).toHaveTextContent(/failing|couldn't sync/i);
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('stays in the neutral pending state while offline, even if sync was failing before connectivity dropped (US-007)', () => {
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
    addPendingEntryCreate({ userId: 1, habitDefinitionId: 10, type: 'custom', date: '2026-08-01', data: {} });
    recordDrainFailure();
    recordDrainFailure();
    recordDrainFailure();

    render(
      <TestProviders initialPath="/">
        <Header />
      </TestProviders>,
    );

    expect(screen.getByRole('status')).not.toHaveTextContent(/failing|couldn't sync/i);
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
  });

  it('re-triggers a drain when the manual retry is clicked', async () => {
    addPendingEntryCreate({ userId: 1, habitDefinitionId: 10, type: 'custom', date: '2026-08-01', data: {} });
    recordDrainFailure();
    recordDrainFailure();
    recordDrainFailure();
    const user = userEvent.setup();
    const fetchSpy = vi.mocked(window.fetch);

    render(
      <TestProviders initialPath="/">
        <Header />
      </TestProviders>,
    );

    fetchSpy.mockClear();
    await user.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() =>
      expect(fetchSpy.mock.calls.some(([input]) => String(input).includes('/entries'))).toBe(true),
    );
  });
});
