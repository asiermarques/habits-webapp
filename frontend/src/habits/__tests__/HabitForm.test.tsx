import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HABIT_CURATED_COLORS, HABIT_NEGATIVE_COLOR } from '@habitsapp/shared';
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

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Reading', type: 'custom', positive: true }),
    );
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

  // Color selector
  it('renders a color selector with a radiogroup', () => {
    render(<HabitForm submitLabel="Add" onSubmit={vi.fn()} />);
    expect(screen.getByRole('group', { name: /color/i })).toBeInTheDocument();
  });

  it('excludes red from the selector for positive habits', () => {
    render(<HabitForm submitLabel="Add" onSubmit={vi.fn()} />);
    const radios = screen.getAllByRole('radio');
    const redRadio = radios.find((r) => r.getAttribute('value') === HABIT_NEGATIVE_COLOR);
    expect(redRadio).toBeUndefined();
  });

  it('includes red in the selector for negative custom habits', async () => {
    const user = userEvent.setup();
    render(<HabitForm submitLabel="Add" onSubmit={vi.fn()} />);

    await user.click(screen.getByRole('switch', { name: 'Positive habit' }));

    const redRadio = screen.getByRole('radio', { name: HABIT_NEGATIVE_COLOR });
    expect(redRadio).toBeInTheDocument();
  });

  it('includes selected color in onSubmit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<HabitForm submitLabel="Add" onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Name'), 'Reading');
    // Pick the second curated color swatch
    await user.click(screen.getByRole('radio', { name: HABIT_CURATED_COLORS[1] }));
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ color: HABIT_CURATED_COLORS[1] }),
    );
  });

  it('resets color to a non-red value when toggling positive off then on while red was selected', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<HabitForm submitLabel="Add" onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Name'), 'Reading');
    // Toggle to negative
    await user.click(screen.getByRole('switch', { name: 'Positive habit' }));
    // Select red
    await user.click(screen.getByRole('radio', { name: HABIT_NEGATIVE_COLOR }));
    // Toggle back to positive
    await user.click(screen.getByRole('switch', { name: 'Positive habit' }));
    // Submit
    await user.click(screen.getByRole('button', { name: 'Add' }));

    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted.color).not.toBe(HABIT_NEGATIVE_COLOR);
    expect(HABIT_CURATED_COLORS as readonly string[]).toContain(submitted.color);
  });

  it('pre-fills the existing color when editing a habit', () => {
    render(
      <HabitForm
        submitLabel="Save"
        onSubmit={vi.fn()}
        initial={{ id: 1, userId: 1, name: 'Run', type: 'custom', positive: true, color: HABIT_CURATED_COLORS[2], createdAt: '', hasEntries: false }}
      />,
    );

    const preselected = screen.getByRole('radio', { name: HABIT_CURATED_COLORS[2] });
    expect(preselected).toBeChecked();
  });
});
