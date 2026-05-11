import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HabitForm } from '../HabitForm';

describe('HabitForm', () => {
  it('hides the positive toggle for workout type', () => {
    render(<HabitForm submitLabel="Add" onSubmit={vi.fn()} initial={{
      id: 1, userId: 1, name: 'Run', type: 'workout', positive: true, color: '#000', createdAt: '', hasEntries: false,
    }} />);

    expect(screen.queryByLabelText('Positive habit')).not.toBeInTheDocument();
  });

  it('shows the positive toggle for custom type', () => {
    render(<HabitForm submitLabel="Add" onSubmit={vi.fn()} initial={{
      id: 1, userId: 1, name: 'Reading', type: 'custom', positive: true, color: '#000', createdAt: '', hasEntries: false,
    }} />);

    expect(screen.getByLabelText('Positive habit')).toBeInTheDocument();
  });

  it('submits the trimmed name with the chosen values', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<HabitForm submitLabel="Add" onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Name'), '  Reading  ');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Reading',
      type: 'custom',
      positive: true,
    });
  });

  it('disables submit when name is empty', () => {
    render(<HabitForm submitLabel="Add" onSubmit={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  });

  it('locks the type selector when typeLocked is true', () => {
    render(
      <HabitForm
        submitLabel="Save"
        onSubmit={vi.fn()}
        typeLocked
        initial={{ id: 1, userId: 1, name: 'Run', type: 'workout', positive: true, color: '#000', createdAt: '', hasEntries: false }}
      />,
    );

    expect(screen.getByText(/Type is locked/)).toBeInTheDocument();
  });
});
