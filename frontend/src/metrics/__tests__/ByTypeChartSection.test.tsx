import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { ByTypeMetrics, User } from '@habitsapp/shared';
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

function makeWeeks(): ByTypeMetrics {
  const weeks = [];
  const start = new Date(Date.UTC(2026, 1, 9)); // 2026-02-09 Mon
  for (let i = 0; i < 13; i++) {
    const ws = new Date(start);
    ws.setUTCDate(start.getUTCDate() + i * 7);
    const we = new Date(ws);
    we.setUTCDate(ws.getUTCDate() + 6);
    weeks.push({
      weekStart: iso(ws),
      weekEnd: iso(we),
      workout: 0,
      writing: 0,
      custom: 0,
    });
  }
  // Put some entries in the last week.
  weeks[12].workout = 3;
  weeks[12].writing = 1;
  weeks[12].custom = 2;
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
const empty: ByTypeMetrics = {
  ...populated,
  weeks: populated.weeks.map((w) => ({ ...w, workout: 0, writing: 0, custom: 0 })),
};

function makeFetch(body: ByTypeMetrics) {
  return vi.fn().mockImplementation((input: string) => {
    if (input.endsWith('/users')) return Promise.resolve(jsonResponse(users));
    if (input.includes('/metrics/by-type')) return Promise.resolve(jsonResponse(body));
    return Promise.resolve(jsonResponse({}));
  });
}

describe('ByTypeChartSection', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    barProps.current = null;
  });

  it('renders 13 stacked weeks with workout/writing/custom keys', async () => {
    vi.stubGlobal('fetch', makeFetch(populated));

    render(
      <TestProviders>
        <ByTypeChartSection />
      </TestProviders>,
    );

    await waitFor(() => expect(screen.getByTestId('responsive-bar')).toBeInTheDocument());

    expect(barProps.current?.groupMode).toBe('stacked');
    expect(barProps.current?.indexBy).toBe('weekLabel');
    expect(barProps.current?.keys).toEqual(['workout', 'writing', 'custom']);

    const data = barProps.current?.data as Array<Record<string, unknown>>;
    expect(data).toHaveLength(13);
    expect(data[12]).toMatchObject({ workout: 3, writing: 1, custom: 2 });
  });

  it('shows the empty state when every week is zero', async () => {
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

  it('uses distinct colors per archetype', async () => {
    vi.stubGlobal('fetch', makeFetch(populated));

    render(
      <TestProviders>
        <ByTypeChartSection />
      </TestProviders>,
    );

    await waitFor(() => expect(barProps.current).not.toBeNull());

    const colorsFn = barProps.current?.colors as (arg: { id: string }) => string;
    expect(colorsFn({ id: 'workout' })).not.toBe(colorsFn({ id: 'writing' }));
    expect(colorsFn({ id: 'writing' })).not.toBe(colorsFn({ id: 'custom' }));
  });
});
