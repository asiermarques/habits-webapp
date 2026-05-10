import { useMemo } from 'react';
import { ResponsiveBar } from '@nivo/bar';
import type { ByTypeMetrics, HabitType } from '@habitsapp/shared';
import { useUserContext } from '@/users/UserContext';
import { useByTypeMetrics } from './queries';

const ARCHETYPE_LABEL: Record<HabitType, string> = {
  workout: 'Workout',
  writing: 'Writing',
  custom: 'Custom',
};

// Distinct, accessible colors per archetype. Negative habits live inside `custom`
// but the per-archetype chart aggregates regardless of `positive`, so red is fine.
const ARCHETYPE_COLOR: Record<HabitType, string> = {
  workout: '#16a34a',
  writing: '#2563eb',
  custom: '#a855f7',
};

const KEYS: HabitType[] = ['workout', 'writing', 'custom'];

const CHART_THEME = {
  axis: {
    ticks: { text: { fontSize: 10, fill: '#525252' } },
  },
  grid: { line: { stroke: '#e5e5e5', strokeDasharray: '2 4' } },
};

export function ByTypeChartSection() {
  const { activeUser } = useUserContext();
  const { data, isLoading } = useByTypeMetrics(activeUser?.id ?? 0);

  const { rows, hasAnyEntry } = useMemo(() => buildRows(data), [data]);

  if (!activeUser) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">By archetype (last 3 months)</h2>

      <div className="rounded-md border border-neutral-200 bg-white p-2">
        {isLoading || !data ? (
          <p className="px-2 py-12 text-center text-sm text-neutral-500">
            Loading…
          </p>
        ) : !hasAnyEntry ? (
          <p className="px-2 py-12 text-center text-sm text-neutral-500">
            No entries in the last 3 months.
          </p>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveBar
              data={rows}
              keys={KEYS}
              indexBy="weekLabel"
              groupMode="stacked"
              layout="vertical"
              margin={{ top: 16, right: 8, bottom: 40, left: 28 }}
              padding={0.25}
              theme={CHART_THEME}
              colors={({ id }) => ARCHETYPE_COLOR[id as HabitType]}
              borderRadius={2}
              enableGridX={false}
              enableGridY
              enableLabel={false}
              axisTop={null}
              axisRight={null}
              axisLeft={{ tickSize: 0, tickPadding: 4, tickValues: 4 }}
              axisBottom={{
                tickSize: 0,
                tickPadding: 6,
                tickRotation: -45,
              }}
              valueScale={{ type: 'linear' }}
              indexScale={{ type: 'band', round: true }}
              tooltip={({ id, value, indexValue }) => (
                <div className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs shadow-sm">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: ARCHETYPE_COLOR[id as HabitType] }}
                    />
                    <span className="font-medium">
                      {ARCHETYPE_LABEL[id as HabitType]}
                    </span>
                  </div>
                  <div className="text-neutral-600">
                    {String(indexValue)}: {value}
                  </div>
                </div>
              )}
              legends={[
                {
                  dataFrom: 'keys',
                  anchor: 'top-left',
                  direction: 'row',
                  translateY: -16,
                  itemWidth: 80,
                  itemHeight: 16,
                  symbolSize: 10,
                  symbolShape: 'square',
                  data: KEYS.map((k) => ({
                    id: k,
                    label: ARCHETYPE_LABEL[k],
                    color: ARCHETYPE_COLOR[k],
                  })),
                },
              ]}
              animate
              motionConfig="gentle"
            />
          </div>
        )}
      </div>
    </section>
  );
}

type ChartRow = {
  weekLabel: string;
  weekStart: string;
  workout: number;
  writing: number;
  custom: number;
};

function buildRows(data: ByTypeMetrics | undefined): {
  rows: ChartRow[];
  hasAnyEntry: boolean;
} {
  if (!data) return { rows: [], hasAnyEntry: false };

  const rows = data.weeks.map((w) => ({
    weekLabel: shortWeekLabel(w.weekStart),
    weekStart: w.weekStart,
    workout: w.workout,
    writing: w.writing,
    custom: w.custom,
  }));

  const hasAnyEntry = rows.some((r) => r.workout + r.writing + r.custom > 0);
  return { rows, hasAnyEntry };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function shortWeekLabel(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}
