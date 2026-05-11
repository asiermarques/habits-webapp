import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import type { HabitDefinition, HeatmapMetrics, User } from '@habitsapp/shared';
import { HeatmapSection } from '../HeatmapSection';
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

const reading: HabitDefinition = {
  id: 10, name: 'Reading', type: 'custom', positive: true,
  color: '#3b82f6', createdAt: 'now', hasEntries: true,
};
const fastFood: HabitDefinition = {
  id: 11, name: 'Fast food', type: 'custom', positive: false,
  color: '#ef4444', createdAt: 'now', hasEntries: true,
};
const habits = [reading, fastFood];

const heatmap: HeatmapMetrics = {
  rangeStart: '2025-11-10', // Mon (26 weeks before 2026-05-10)
  rangeEnd: '2026-05-10',   // Sun
  habits: [
    {
      habitDefinitionId: 10,
      days: [
        { date: '2025-11-10', count: 1 },
        { date: '2026-05-09', count: 5 },
      ],
    },
    {
      habitDefinitionId: 11,
      days: [{ date: '2026-04-01', count: 2 }],
    },
  ],
};

function makeFetch(body: HeatmapMetrics) {
  return vi.fn().mockImplementation((input: string) => {
    if (input.endsWith('/users')) return Promise.resolve(jsonResponse(users));
    if (input.includes('/habit-definitions')) return Promise.resolve(jsonResponse(habits));
    if (input.includes('/metrics/heatmap')) return Promise.resolve(jsonResponse(body));
    return Promise.resolve(jsonResponse({}));
  });
}

describe('HeatmapSection', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('renders one card per habit with the entry totals', async () => {
    vi.stubGlobal('fetch', makeFetch(heatmap));

    render(
      <TestProviders>
        <HeatmapSection />
      </TestProviders>,
    );

    await waitFor(() => expect(screen.getByText('Reading')).toBeInTheDocument());
    expect(screen.getByText('Fast food')).toBeInTheDocument();
    expect(screen.getByText('6 entries')).toBeInTheDocument(); // reading total
    expect(screen.getByText('2 entries')).toBeInTheDocument(); // fast food total
  });

  it('emits a 26×7 grid (182 cells) per habit', async () => {
    vi.stubGlobal('fetch', makeFetch(heatmap));

    render(
      <TestProviders>
        <HeatmapSection />
      </TestProviders>,
    );

    await waitFor(() => expect(screen.getByLabelText(/Reading heatmap/)).toBeInTheDocument());

    const readingGrid = screen.getByLabelText('Reading heatmap');
    const cells = within(readingGrid).getAllByRole('gridcell');
    expect(cells).toHaveLength(26 * 7);

    // First and last cells correspond to range bounds.
    expect(cells[0]).toHaveAttribute('aria-label', expect.stringContaining('2025-11-10'));
    expect(cells[cells.length - 1]).toHaveAttribute(
      'aria-label',
      expect.stringContaining('2026-05-10'),
    );
  });

  it('paints positive habits with their color and negative habits red', async () => {
    vi.stubGlobal('fetch', makeFetch(heatmap));

    render(
      <TestProviders>
        <HeatmapSection />
      </TestProviders>,
    );

    await waitFor(() => expect(screen.getByLabelText('Reading heatmap')).toBeInTheDocument());

    const readingHit = within(screen.getByLabelText('Reading heatmap')).getByLabelText(
      '2026-05-09: 5 entries',
    );
    expect(readingHit.style.gridRow).toBe('6'); // Saturday (Mon=1..Sun=7)
    // jsdom normalizes hex colors to rgb in style.backgroundColor.
    expect(readingHit.style.backgroundColor).toBe('rgb(59, 130, 246)'); // #3b82f6

    const negativeHit = within(screen.getByLabelText('Fast food heatmap')).getByLabelText(
      '2026-04-01: 2 entries',
    );
    expect(negativeHit.style.backgroundColor).toBe('rgb(239, 68, 68)'); // #ef4444
  });

  it('shows a friendly message when no habits exist', async () => {
    vi.stubGlobal('fetch', makeFetch({ ...heatmap, habits: [] }));

    render(
      <TestProviders>
        <HeatmapSection />
      </TestProviders>,
    );

    await waitFor(() =>
      expect(screen.getByText('No habits configured yet.')).toBeInTheDocument(),
    );
  });
});
