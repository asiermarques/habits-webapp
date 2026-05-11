import { useMemo } from 'react';
import { ResponsiveBar } from '@nivo/bar';
import type { ByHabitMetrics, HabitDefinition } from '@habitsapp/shared';
import { useUserContext } from '@/users/UserContext';
import { useHabitDefinitionsQuery } from '@/habits/queries';
import { useByHabitMetrics } from './queries';

const CHART_THEME = {
  axis: {
    ticks: { text: { fontSize: 10, fill: '#525252' } },
  },
  grid: { line: { stroke: '#e5e5e5', strokeDasharray: '2 4' } },
};

export function ByTypeChartSection() {
  const { activeUser } = useUserContext();
  const { data: habits = [] } = useHabitDefinitionsQuery(activeUser?.id ?? 0);
  const { data, isLoading } = useByHabitMetrics(activeUser?.id ?? 0);

  const habitsById = useMemo(
    () => new Map(habits.map((h) => [h.id, h])),
    [habits],
  );

  const { rows, keys, hasAnyEntry } = useMemo(
    () => buildChartModel(data, habitsById),
    [data, habitsById],
  );

  if (!activeUser) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">By habit (last 3 months)</h2>

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
          <>
            <div className="h-64 w-full">
              <ResponsiveBar
                data={rows}
                keys={keys}
                indexBy="weekLabel"
                groupMode="stacked"
                layout="vertical"
                margin={{ top: 16, right: 8, bottom: 40, left: 28 }}
                padding={0.25}
                theme={CHART_THEME}
                colors={({ id }) => habitsById.get(Number(id))?.color ?? '#999'}
                borderRadius={2}
                enableGridX={false}
                enableGridY
                enableLabel={false}
                axisTop={null}
                axisRight={null}
                axisLeft={{ tickSize: 0, tickPadding: 4, tickValues: 4 }}
                axisBottom={{ tickSize: 0, tickPadding: 6, tickRotation: -45 }}
                valueScale={{ type: 'linear' }}
                indexScale={{ type: 'band', round: true }}
                tooltip={({ id, value, indexValue }) => {
                  const habit = habitsById.get(Number(id));
                  return (
                    <div className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs shadow-sm">
                      <div className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: habit?.color ?? '#999' }}
                        />
                        <span className="font-medium">{habit?.name ?? 'Unknown'}</span>
                      </div>
                      <div className="text-neutral-600">
                        {String(indexValue)}: {value}
                      </div>
                    </div>
                  );
                }}
                animate
                motionConfig="gentle"
              />
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 px-2 pb-1 pt-0.5">
              {keys.map((k) => {
                const habit = habitsById.get(Number(k));
                return (
                  <div key={k} className="flex items-center gap-1.5 text-xs text-neutral-600">
                    <span
                      aria-hidden
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                      style={{ backgroundColor: habit?.color ?? '#999' }}
                    />
                    {habit?.name ?? k}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

type ChartRow = { weekLabel: string; weekStart: string } & Record<string, number | string>;

function buildChartModel(
  data: ByHabitMetrics | undefined,
  habitsById: Map<number, HabitDefinition>,
): { rows: ChartRow[]; keys: string[]; hasAnyEntry: boolean } {
  if (!data) return { rows: [], keys: [], hasAnyEntry: false };

  const present = new Set<number>();
  for (const week of data.weeks) {
    for (const h of week.habits) present.add(h.habitDefinitionId);
  }

  const keys = [...present]
    .sort((a, b) => {
      const an = habitsById.get(a)?.name ?? '';
      const bn = habitsById.get(b)?.name ?? '';
      return an.localeCompare(bn);
    })
    .map(String);

  const rows: ChartRow[] = data.weeks.map((week) => {
    const row: ChartRow = { weekLabel: shortWeekLabel(week.weekStart), weekStart: week.weekStart };
    for (const k of keys) row[k] = 0;
    for (const h of week.habits) row[String(h.habitDefinitionId)] = h.count;
    return row;
  });

  return { rows, keys, hasAnyEntry: keys.length > 0 };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function shortWeekLabel(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}
