import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DatePicker } from '../date-picker';

describe('DatePicker', () => {
  it('renders the trigger with the formatted selected date', () => {
    render(<DatePicker id="d" value="2026-05-09" onChange={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: /open date picker/i });
    expect(trigger.textContent).toMatch(/9/);
    expect(trigger.textContent).toMatch(/2026/);
  });

  it('shows a placeholder when no value is selected', () => {
    render(<DatePicker id="d" value="" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /open date picker/i })).toHaveTextContent(
      /pick a date/i,
    );
  });

  it('opens the calendar grid on trigger click and shows the current month', async () => {
    const user = userEvent.setup();
    render(<DatePicker id="d" value="2026-05-09" onChange={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /open date picker/i }));
    const grid = screen.getByRole('grid');
    expect(within(grid).getByRole('button', { name: /^9$/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText(/May 2026/)).toBeInTheDocument();
  });

  it('calls onChange with the picked ISO date and closes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DatePicker id="d" value="2026-05-09" onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /open date picker/i }));
    await user.click(within(screen.getByRole('grid')).getByRole('button', { name: /^14$/ }));
    expect(onChange).toHaveBeenCalledWith('2026-05-14');
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
  });

  it('navigates to the previous and next month', async () => {
    const user = userEvent.setup();
    render(<DatePicker id="d" value="2026-05-09" onChange={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /open date picker/i }));
    await user.click(screen.getByRole('button', { name: /previous month/i }));
    expect(screen.getByText(/April 2026/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /next month/i }));
    await user.click(screen.getByRole('button', { name: /next month/i }));
    expect(screen.getByText(/June 2026/i)).toBeInTheDocument();
  });

  it('disables days outside the [min, max] window', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DatePicker id="d" value="2026-05-09" max="2026-05-10" onChange={onChange} />,
    );
    await user.click(screen.getByRole('button', { name: /open date picker/i }));
    const grid = screen.getByRole('grid');
    expect(within(grid).getByRole('button', { name: /^15$/ })).toBeDisabled();
    await user.click(within(grid).getByRole('button', { name: /^15$/ }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
