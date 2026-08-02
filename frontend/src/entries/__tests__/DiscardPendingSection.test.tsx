import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DiscardPendingSection } from '../DiscardPendingSection';
import { addPendingEntryCreate, getPendingEntries } from '../offlineStore';
import { TestProviders } from '@/test/test-utils';

describe('DiscardPendingSection', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders nothing when there is nothing pending', () => {
    render(
      <TestProviders>
        <DiscardPendingSection />
      </TestProviders>,
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows the discard action with a count when changes are pending', () => {
    addPendingEntryCreate({ userId: 1, habitDefinitionId: 2, type: 'workout', date: '2026-08-01', data: {} });
    addPendingEntryCreate({ userId: 1, habitDefinitionId: 2, type: 'workout', date: '2026-08-02', data: {} });

    render(
      <TestProviders>
        <DiscardPendingSection />
      </TestProviders>,
    );

    expect(screen.getByRole('button', { name: /discard 2 pending changes/i })).toBeInTheDocument();
  });

  it('does nothing until the confirmation is accepted', async () => {
    addPendingEntryCreate({ userId: 1, habitDefinitionId: 2, type: 'workout', date: '2026-08-01', data: {} });
    const user = userEvent.setup();

    render(
      <TestProviders>
        <DiscardPendingSection />
      </TestProviders>,
    );

    await user.click(screen.getByRole('button', { name: /discard 1 pending change/i }));
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(getPendingEntries()).toHaveLength(1);
  });

  it('discards every pending change once the confirmation is accepted', async () => {
    addPendingEntryCreate({ userId: 1, habitDefinitionId: 2, type: 'workout', date: '2026-08-01', data: {} });
    addPendingEntryCreate({ userId: 1, habitDefinitionId: 2, type: 'workout', date: '2026-08-02', data: {} });
    const user = userEvent.setup();

    render(
      <TestProviders>
        <DiscardPendingSection />
      </TestProviders>,
    );

    await user.click(screen.getByRole('button', { name: /discard 2 pending changes/i }));
    await user.click(screen.getByRole('button', { name: /discard all pending changes/i }));

    expect(getPendingEntries()).toEqual([]);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
