import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { Entry, HabitDefinition, User } from '@habitsapp/shared';
import { EntriesList } from '../EntriesList';
import { addPendingEntryCreate, addPendingEntryUpdate, addPendingEntryDelete } from '../offlineStore';
import { TestProviders } from '@/test/test-utils';

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

const users: User[] = [{ id: 1, name: 'Alice', isDefault: true, createdAt: 'now' }];

const running: HabitDefinition = {
  id: 11, userId: 1, name: 'Running', type: 'workout', positive: true,
  color: '#22c55e', createdAt: 'now', hasEntries: true,
};

const serverEntry: Entry = {
  id: 1, habitDefinitionId: 11, userId: 1, date: '2026-08-01', createdAt: 'now',
  type: 'workout', data: { duration: 20 },
};

function makeFetch() {
  return vi.fn().mockImplementation((input: string) => {
    if (input.endsWith('/users')) return Promise.resolve(jsonResponse(users));
    if (input.includes('/habit-definitions')) return Promise.resolve(jsonResponse([running]));
    if (input.includes('/entries')) {
      return Promise.resolve(jsonResponse({ items: [serverEntry], nextCursor: null }));
    }
    return Promise.resolve(jsonResponse({}));
  });
}

describe('EntriesList pending overlay', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('renders a pending offline entry alongside server entries with no distinguishing marker', async () => {
    addPendingEntryCreate({
      userId: 1,
      habitDefinitionId: 11,
      type: 'workout',
      date: '2026-08-02',
      data: { duration: 45 },
    });

    vi.stubGlobal('fetch', makeFetch());

    render(
      <TestProviders>
        <EntriesList onEdit={vi.fn()} />
      </TestProviders>,
    );

    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2));

    const items = screen.getAllByRole('listitem');
    // Newest (pending, 08-02) first, then the server entry (08-01).
    expect(items[0]).toHaveTextContent('45');
    expect(items[1]).toHaveTextContent('20');

    // No per-row marker distinguishes the pending entry (requisites UX note).
    expect(screen.queryByText(/pending/i)).not.toBeInTheDocument();
  });

  it('shows a queued offline edit to a synced Entry instead of its server value', async () => {
    addPendingEntryUpdate({ entryId: 1, userId: 1, habitDefinitionId: 2, type: 'workout', date: '2026-08-01', data: { duration: 99 } });

    vi.stubGlobal('fetch', makeFetch());

    render(
      <TestProviders>
        <EntriesList onEdit={vi.fn()} />
      </TestProviders>,
    );

    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(1));
    expect(screen.getByRole('listitem')).toHaveTextContent('99');
  });

  it('suppresses a synced Entry that was deleted offline, even though the cached response still has it', async () => {
    addPendingEntryDelete({
      entryId: 1,
      userId: 1,
      habitDefinitionId: 11,
      type: 'workout',
      date: '2026-08-01',
      data: { duration: 20 },
    });

    vi.stubGlobal('fetch', makeFetch());

    render(
      <TestProviders>
        <EntriesList onEdit={vi.fn()} />
      </TestProviders>,
    );

    await waitFor(() => expect(screen.queryByText(/no entries|empty/i)).toBeInTheDocument());
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });
});
