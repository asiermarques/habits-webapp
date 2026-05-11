import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { HabitDefinition, User } from '@habitsapp/shared';
import { Header } from '../Header';
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
  id: 10, name: 'Reading', type: 'custom', positive: true,
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

  it('shows the back arrow and hides the Log icon on non-home routes', async () => {
    render(
      <TestProviders initialPath="/metrics">
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
});
