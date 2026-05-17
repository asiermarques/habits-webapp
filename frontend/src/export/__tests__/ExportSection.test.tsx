import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { User } from '@habitsapp/shared';
import { ExportSection } from '../ExportSection';
import { TestProviders } from '@/test/test-utils';

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

const users: User[] = [
  { id: 1, name: 'Alice', isDefault: true, createdAt: 'now' },
];

function setup(extraFetchHandler?: (input: string) => Promise<Response> | undefined) {
  const csvBody = 'date,habit_name,type\n2026-01-01,Reading,custom\n';
  const csvResponse = () =>
    new Response(csvBody, {
      status: 200,
      headers: { 'Content-Type': 'text/csv; charset=utf-8' },
    });

  const fetchMock = vi.fn(async (input: string) => {
    const extra = extraFetchHandler?.(input);
    if (extra) return extra;
    if (input.endsWith('/users')) return jsonResponse(users);
    if (input.includes('/export/csv')) return csvResponse();
    return jsonResponse({});
  });

  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, csvBody };
}

describe('ExportSection', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('starts collapsed and expands when the toggle is clicked', async () => {
    setup();
    render(
      <TestProviders>
        <ExportSection />
      </TestProviders>,
    );

    const toggle = await screen.findByRole('button', { name: 'Export CSV' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByLabelText('From')).not.toBeInTheDocument();

    await userEvent.setup().click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('From')).toBeInTheDocument();
    expect(screen.getByLabelText('To')).toBeInTheDocument();
    expect(screen.queryByLabelText('User')).not.toBeInTheDocument();
  });

  it('triggers a download with userId, from and to in the URL', async () => {
    const { fetchMock } = setup();

    // jsdom doesn't implement createObjectURL.
    const createObjectURL = vi.fn(() => 'blob:mock');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });

    const anchorClick = vi.fn();
    const originalCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      const el = originalCreate(tag);
      if (tag === 'a') {
        Object.defineProperty(el, 'click', { value: anchorClick });
      }
      return el;
    }) as typeof document.createElement);

    render(
      <TestProviders>
        <ExportSection />
      </TestProviders>,
    );

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Export CSV' })).toBeInTheDocument(),
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));

    // Pin from/to to deterministic values via the custom DatePicker.
    async function pickDate(triggerLabel: 'From' | 'To', targetYear: number, targetMonth: number, day: number) {
      await user.click(screen.getByLabelText(triggerLabel));
      const dialog = await screen.findByRole('dialog', { name: /choose date/i });
      // Iterate month nav until the dialog header matches.
      const targetHeader = new RegExp(
        `${['January','February','March','April','May','June','July','August','September','October','November','December'][targetMonth]} ${targetYear}`,
      );
      while (!targetHeader.test(dialog.textContent ?? '')) {
        await user.click(screen.getByRole('button', { name: /previous month/i }));
      }
      const cell = screen.getAllByRole('button', { name: new RegExp(`^${day}$`) })[0];
      await user.click(cell);
    }
    await pickDate('From', 2026, 0, 1);
    await pickDate('To', 2026, 0, 31);

    await user.click(screen.getByRole('button', { name: 'Export' }));

    await waitFor(() => expect(anchorClick).toHaveBeenCalled());

    const exportCalls = fetchMock.mock.calls
      .map((c) => String(c[0]))
      .filter((u) => u.includes('/export/csv'));
    expect(exportCalls).toHaveLength(1);
    expect(exportCalls[0]).toContain('userId=1');
    expect(exportCalls[0]).toContain('from=2026-01-01');
    expect(exportCalls[0]).toContain('to=2026-01-31');
    expect(createObjectURL).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock');
  });

  it('shows the server error message when the export request fails', async () => {
    setup((input) => {
      if (input.includes('/export/csv')) {
        return Promise.resolve(
          new Response(JSON.stringify({ error: 'from must be on or before to' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      return undefined;
    });

    render(
      <TestProviders>
        <ExportSection />
      </TestProviders>,
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Export CSV' })).toBeInTheDocument(),
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));
    await user.click(screen.getByRole('button', { name: 'Export' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('from must be on or before to'),
    );
  });
});
