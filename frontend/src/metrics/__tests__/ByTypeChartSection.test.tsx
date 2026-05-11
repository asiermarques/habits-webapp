import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { ByHabitMetrics, ByHabitWeek, HabitDefinition, User } from '@habitsapp/shared';
import { ByTypeChartSection } from '../ByTypeChartSection';
import { TestProviders } from '@/test/test-utils';

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

const habitDefs: HabitDefinition[] = [
  { id: 10, userId: 1, name: 'Running', type: 'workout', positive: true, color: '#16a34a', createdAt: '', hasEntries: true },
  { id: 11, userId: 1, name: 'Journal', type: 'writing', positive: true, color: '#2563eb', createdAt: '', hasEntries: true },
];

function makeWeeks(): ByHabitMetrics {
  const weeks: ByHabitWeek[] = [];
  const start = new Date(Date.UTC(2026, 1, 9)); // 2026-02-09 Mon
  for (let i = 0; i < 13; i++) {
    const ws = new Date(start);
    ws.setUTCDate(start.getUTCDate() + i * 7);
    const we = new Date(ws);
    we.setUTCDate(ws.getUTCDate() + 6);
    weeks.push({ weekStart: iso(ws), weekEnd: iso(we), habits: [] });
  }
  weeks[12].habits = [
    { habitDefinitionId: 10, count: 5 },
    { habitDefinitionId: 11, count: 2 },
  ];
  return {
    rangeStart: weeks[0].weekStart,
    rangeEnd: weeks[12].weekEnd,
    weeks,
  };
}

function iso(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const populated = makeWeeks();
const empty: ByHabitMetrics = {
  ...populated,
  weeks: populated.weeks.map((w) => ({ ...w, habits: [] })),
};

function makeFetch(body: ByHabitMetrics) {
  return vi.fn().mockImplementation((input: string) => {
    if (input.endsWith('/users')) return Promise.resolve(jsonResponse(users));
    if (input.includes('/habit-definitions')) return Promise.resolve(jsonResponse(habitDefs));
    if (input.includes('/metrics/by-habit')) return Promise.resolve(jsonResponse(body));
    return Promise.resolve(jsonResponse({}));
  });
}

describe('ByTypeChartSection', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    barProps.current = null;
  });

  it('renders 13 stacked weeks keyed by habit id', async () => {
    vi.stubGlobal('fetch', makeFetch(populated));

    render(
      <TestProviders>
        <ByTypeChartSection />
      </TestProviders>,
    );

    await waitFor(() => expect(screen.getByTestId('responsive-bar')).toBeInTheDocument());

    expect(barProps.current?.groupMode).toBe('stacked');
    expect(barProps.current?.indexBy).toBe('weekLabel');

    const data = barProps.current?.data as Array<Record<string, unknown>>;
    expect(data).toHaveLength(13);
    expect(data[12]['10']).toBe(5);
    expect(data[12]['11']).toBe(2);
  });

  it('shows the empty state when every week has no habits', async () => {
    vi.stubGlobal('fetch', makeFetch(empty));

    render(
      <TestProviders>
        <ByTypeChartSection />
      </TestProviders>,
    );

    await waitFor(() =>
      expect(screen.getByText('No entries in the last 3 months.')).toBeInTheDocument(),
    );
    expect(screen.queryByTestId('responsive-bar')).not.toBeInTheDocument();
  });

  it('uses habit colors from habit definitions', async () => {
    vi.stubGlobal('fetch', makeFetch(populated));

    render(
      <TestProviders>
        <ByTypeChartSection />
      </TestProviders>,
    );

    await waitFor(() => expect(barProps.current).not.toBeNull());

    const colorsFn = barProps.current?.colors as (arg: { id: string }) => string;
    expect(colorsFn({ id: '10' })).toBe('#16a34a');
    expect(colorsFn({ id: '11' })).toBe('#2563eb');
    expect(colorsFn({ id: '10' })).not.toBe(colorsFn({ id: '11' }));
  });
});
