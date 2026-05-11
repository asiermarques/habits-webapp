import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type {
  HabitDefinition,
  User,
  WeeklyMetrics,
} from '@habitsapp/shared';
import { WeekChartSection } from '../WeekChartSection';
import { TestProviders } from '@/test/test-utils';

// Capture the props Nivo's ResponsiveBar receives so we can assert on the chart model
// without touching the SVG/measure machinery (which is unreliable in jsdom).
const barProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
vi.mock('@nivo/bar', () => ({
  ResponsiveBar: (props: Record<string, unknown>) => {
    barProps.current = props;
    return <div data-testid="responsive-bar" />;
  },
}));

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
  id: 10, userId: 1, name: 'Reading', type: 'custom', positive: true,
  color: '#3b82f6', createdAt: 'now', hasEntries: true,
};
const running: HabitDefinition = {
  id: 11, userId: 1, name: 'Running', type: 'workout', positive: true,
  color: '#22c55e', createdAt: 'now', hasEntries: true,
};
const habits = [reading, running];

const weeklyAll: WeeklyMetrics = {
  weekStart: '2026-05-04',
  weekEnd: '2026-05-10',
  days: [
    { date: '2026-05-04', counts: [{ habitDefinitionId: 10, count: 2 }, { habitDefinitionId: 11, count: 1 }] },
    { date: '2026-05-05', counts: [] },
    { date: '2026-05-06', counts: [{ habitDefinitionId: 11, count: 3 }] },
    { date: '2026-05-07', counts: [] },
    { date: '2026-05-08', counts: [] },
    { date: '2026-05-09', counts: [{ habitDefinitionId: 10, count: 1 }] },
    { date: '2026-05-10', counts: [] },
  ],
};

const weeklyEmpty: WeeklyMetrics = {
  weekStart: '2026-05-04',
  weekEnd: '2026-05-10',
  days: weeklyAll.days.map((d) => ({ date: d.date, counts: [] })),
};

function makeFetch(weekly: WeeklyMetrics) {
  return vi.fn().mockImplementation((input: string) => {
    if (input.endsWith('/users')) return Promise.resolve(jsonResponse(users));
    if (input.includes('/habit-definitions')) return Promise.resolve(jsonResponse(habits));
    if (input.includes('/metrics/weekly')) return Promise.resolve(jsonResponse(weekly));
    return Promise.resolve(jsonResponse({}));
  });
}

describe('WeekChartSection', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    barProps.current = null;
  });

  it('renders a stacked bar chart with one key per habit present in the week', async () => {
    vi.stubGlobal('fetch', makeFetch(weeklyAll));

    render(
      <TestProviders>
        <WeekChartSection />
      </TestProviders>,
    );

    await waitFor(() => expect(screen.getByTestId('responsive-bar')).toBeInTheDocument());

    expect(barProps.current?.groupMode).toBe('stacked');
    expect(barProps.current?.indexBy).toBe('day');
    // Keys are habit ids (as strings) sorted by name: Reading (10), Running (11).
    expect(barProps.current?.keys).toEqual(['10', '11']);

    const data = barProps.current?.data as Array<Record<string, unknown>>;
    expect(data).toHaveLength(7);
    expect(data[0]).toMatchObject({ day: 'Mon', date: '2026-05-04', '10': 2, '11': 1 });
    expect(data[6]).toMatchObject({ day: 'Sun', date: '2026-05-10', '10': 0, '11': 0 });
  });

  it('uses each habit\'s color in the colors function', async () => {
    vi.stubGlobal('fetch', makeFetch(weeklyAll));

    render(
      <TestProviders>
        <WeekChartSection />
      </TestProviders>,
    );

    await waitFor(() => expect(barProps.current).not.toBeNull());

    const colorsFn = barProps.current?.colors as (arg: { id: string }) => string;
    expect(colorsFn({ id: '10' })).toBe(reading.color);
    expect(colorsFn({ id: '11' })).toBe(running.color);
  });

  it('hides axisLeft and totals are enabled', async () => {
    vi.stubGlobal('fetch', makeFetch(weeklyAll));

    render(
      <TestProviders>
        <WeekChartSection />
      </TestProviders>,
    );

    await waitFor(() => expect(barProps.current).not.toBeNull());

    expect(barProps.current?.axisLeft).toBeNull();
    expect(barProps.current?.enableTotals).toBe(true);
  });

  it('renders the totals (theme.labels.text) at 3x the X-axis tick font size', async () => {
    vi.stubGlobal('fetch', makeFetch(weeklyAll));

    render(
      <TestProviders>
        <WeekChartSection />
      </TestProviders>,
    );

    await waitFor(() => expect(barProps.current).not.toBeNull());

    const theme = barProps.current?.theme as
      | { labels?: { text?: { fontSize?: number } } }
      | undefined;
    // Nivo's default axis-tick fontSize is 11; bar totals pull from theme.labels.text.
    expect(theme?.labels?.text?.fontSize).toBe(22);
  });

  it('shows the empty state when no entries exist this week', async () => {
    vi.stubGlobal('fetch', makeFetch(weeklyEmpty));

    render(
      <TestProviders>
        <WeekChartSection />
      </TestProviders>,
    );

    await waitFor(() =>
      expect(screen.getByText('No entries this week.')).toBeInTheDocument(),
    );
    expect(screen.queryByTestId('responsive-bar')).not.toBeInTheDocument();
  });

  it('passes habitDefinitionId through to the API and limits keys when filtered', async () => {
    const filtered: WeeklyMetrics = {
      ...weeklyAll,
      days: weeklyAll.days.map((d) => ({
        date: d.date,
        counts: d.counts.filter((c) => c.habitDefinitionId === 11),
      })),
    };
    const fetchMock = makeFetch(filtered);
    vi.stubGlobal('fetch', fetchMock);

    render(
      <TestProviders>
        <WeekChartSection habitDefinitionId={11} />
      </TestProviders>,
    );

    await waitFor(() => expect(barProps.current).not.toBeNull());

    expect(barProps.current?.keys).toEqual(['11']);

    const calls = fetchMock.mock.calls.map((c) => String(c[0]));
    const weeklyCall = calls.find((u) => u.includes('/metrics/weekly'));
    expect(weeklyCall).toContain('habitDefinitionId=11');
  });
});
