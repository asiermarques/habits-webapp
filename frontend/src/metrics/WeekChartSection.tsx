import { useMemo } from 'react';
import { ResponsiveBar } from '@nivo/bar';
import type { HabitDefinition, WeeklyMetrics } from '@habitsapp/shared';
import { useUserContext } from '@/users/UserContext';
import { useHabitDefinitionsQuery } from '@/habits/queries';
import { useWeeklyMetrics } from './queries';
import { t } from '@/lib/i18n';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

// Nivo's default axis-tick fontSize is ~11px. enableLabel is off, so theme.labels.text
// only styles the totals shown above each bar (fontWeight: "bold" is hardcoded in
// @nivo/bar's BarTotals component).
const TICK_FONT_SIZE = 11;
const CHART_THEME = {
  labels: {
    text: {
      fontSize: TICK_FONT_SIZE * 2,
      fill: '#434141', 
    },
  },
};

type WeekChartSectionProps = {
  habitDefinitionId?: number;
};

export function WeekChartSection({ habitDefinitionId }: WeekChartSectionProps) {
  const { activeUser } = useUserContext();
  const { data: habits = [] } = useHabitDefinitionsQuery(activeUser?.id ?? 0);
  const { data: weekly, isLoading } = useWeeklyMetrics(
    activeUser?.id ?? 0,
    habitDefinitionId,
  );

  const habitsById = useMemo(
    () => new Map(habits.map((h) => [h.id, h])),
    [habits],
  );

  const { rows, keys, hasAnyEntry } = useMemo(
    () => buildChartModel(weekly, habitsById),
    [weekly, habitsById],
  );

  if (!activeUser) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">{t('metrics.weekly')}</h2>

      <div className="rounded-md border border-hairline bg-card p-2">
        {isLoading || !weekly ? (
          <p className="px-2 py-12 text-center text-sm text-ink-soft">
            {t('metrics.loading')}
          </p>
        ) : !hasAnyEntry ? (
          <p className="px-2 py-12 text-center text-sm text-ink-soft">
            {t('metrics.noEntriesWeek')}
          </p>
        ) : (
          <div className="h-56 w-full">
            <ResponsiveBar
              data={rows}
              keys={keys}
              indexBy="day"
              groupMode="stacked"
              layout="vertical"
              margin={{ top: 36, right: 8, bottom: 28, left: 8 }}
              padding={0.3}
              theme={CHART_THEME}
              colors={({ id }) => habitsById.get(Number(id))?.color ?? '#999'}
              borderRadius={2}
              enableGridX={false}
              enableGridY={false}
              enableLabel={false}
              enableTotals
              totalsOffset={6}
              axisTop={null}
              axisRight={null}
              axisLeft={null}
              axisBottom={{ tickSize: 0, tickPadding: 6 }}
              valueScale={{ type: 'linear' }}
              indexScale={{ type: 'band', round: true }}
              tooltip={({ id, value, indexValue, color }) => (
                <ChartTooltip
                  habit={habitsById.get(Number(id))}
                  value={value}
                  day={String(indexValue)}
                  color={color}
                />
              )}
              animate
              motionConfig="gentle"
            />
          </div>
        )}
      </div>
    </section>
  );
}

type ChartRow = { day: string; date: string } & Record<string, number | string>;

function buildChartModel(
  weekly: WeeklyMetrics | undefined,
  habitsById: Map<number, HabitDefinition>,
): { rows: ChartRow[]; keys: string[]; hasAnyEntry: boolean } {
  if (!weekly) return { rows: [], keys: [], hasAnyEntry: false };

  // Stable ordering: union of habit ids present in any day, sorted by name.
  const present = new Set<number>();
  for (const day of weekly.days) {
    for (const c of day.counts) present.add(c.habitDefinitionId);
  }
  const keys = [...present]
    .sort((a, b) => {
      const an = habitsById.get(a)?.name ?? '';
      const bn = habitsById.get(b)?.name ?? '';
      return an.localeCompare(bn);
    })
    .map(String);

  const rows: ChartRow[] = weekly.days.map((day, i) => {
    const row: ChartRow = { day: WEEKDAY_LABELS[i], date: day.date };
    for (const k of keys) row[k] = 0;
    for (const c of day.counts) row[String(c.habitDefinitionId)] = c.count;
    return row;
  });

  return { rows, keys, hasAnyEntry: keys.length > 0 };
}

type ChartTooltipProps = {
  habit?: HabitDefinition;
  value: number;
  day: string;
  color: string;
};

function ChartTooltip({ habit, value, day, color }: ChartTooltipProps) {
  return (
    <div className="rounded-md border border-hairline bg-card px-2 py-1 text-xs shadow-sm">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="font-medium">{habit?.name ?? t('metrics.unknown')}</span>
      </div>
      <div className="text-ink-soft">
        {day}: {value}
      </div>
    </div>
  );
}
