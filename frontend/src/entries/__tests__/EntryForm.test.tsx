import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { HabitDefinition } from '@habitsapp/shared';
import { EntryForm } from '../EntryForm';

const habits: HabitDefinition[] = [
  { id: 1, name: 'Running', type: 'workout', positive: true, color: '#000', createdAt: '', hasEntries: false },
  { id: 2, name: 'Journal', type: 'writing', positive: true, color: '#000', createdAt: '', hasEntries: false },
  { id: 3, name: 'Reading', type: 'custom', positive: true, color: '#000', createdAt: '', hasEntries: false },
];

describe('EntryForm', () => {
  it('renders the workout fields when a workout habit is selected', () => {
    render(<EntryForm habits={[habits[0]]} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/Duration \(min\)/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Distance \(km\)/)).toBeInTheDocument();
  });

  it('renders the writing fields when a writing habit is selected', () => {
    render(<EntryForm habits={[habits[1]]} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/Words/)).toBeInTheDocument();
  });

  it('renders the custom fields when a custom habit is selected', () => {
    render(<EntryForm habits={[habits[2]]} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText('Repetitions')).toBeInTheDocument();
    expect(screen.getByLabelText(/Cost spent \(EUR\)/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Duration \(min\)/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Done?')).not.toBeInTheDocument();
  });

  it('shows the configured currency in the Cost spent label', () => {
    render(<EntryForm habits={[habits[2]]} currency="USD" onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/Cost spent \(USD\)/)).toBeInTheDocument();
  });

  it('locks the habit selector when editing an existing entry', () => {
    const initial = {
      id: 1,
      habitDefinitionId: 1,
      userId: 1,
      date: '2026-05-09',
      createdAt: '',
      type: 'workout' as const,
      data: { duration: 30 },
    };
    render(<EntryForm habits={habits} initial={initial} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText('Habit')).toBeDisabled();
  });

  it('shows an empty-state message when there are no habits', () => {
    render(<EntryForm habits={[]} onSubmit={vi.fn()} />);
    expect(screen.getByText(/No habit definitions yet/i)).toBeInTheDocument();
  });

  it('submits the typed values', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<EntryForm habits={[habits[1]]} onSubmit={onSubmit} />);
    await user.clear(screen.getByLabelText(/Words/));
    await user.type(screen.getByLabelText(/Words/), '420');
    await user.click(screen.getByRole('button', { name: 'Log entry' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const args = onSubmit.mock.calls[0][0];
    expect(args.habitDefinitionId).toBe(2);
    expect(args.data.words).toBe(420);
  });
});
