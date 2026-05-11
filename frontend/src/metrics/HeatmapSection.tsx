import { useMemo } from 'react';
import type { HabitDefinition, HabitHeatmap } from '@habitsapp/shared';
import { useUserContext } from '@/users/UserContext';
import { useHabitDefinitionsQuery } from '@/habits/queries';
import { useHeatmapMetrics } from './queries';

const NEGATIVE_COLOR = '#ef4444';
const EMPTY_CELL = '#f5f5f5';

// Opacity ramp by count bucket (0..4). The base color is the habit's color
// (or red for negative habits).
const INTENSITY_OPACITY = [0, 0.25, 0.5, 0.75, 1];

const WEEKDAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'];

export function HeatmapSection() {
  const { activeUser } = useUserContext();
  const { data: habits = [] } = useHabitDefinitionsQuery(activeUser?.id ?? 0);
  const { data: heatmap, isLoading } = useHeatmapMetrics(activeUser?.id ?? 0);

  const habitsById = useMemo(
    () => new Map(habits.map((h) => [h.id, h])),
    [habits],
  );

  if (!activeUser) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Heatmaps (last 6 months)</h2>

      {isLoading || !heatmap ? (
        <p className="rounded-md border border-neutral-200 bg-white px-3 py-12 text-center text-sm text-neutral-500">
          Loading…
        </p>
      ) : heatmap.habits.length === 0 ? (
        <p className="rounded-md border border-neutral-200 bg-white px-3 py-12 text-center text-sm text-neutral-500">
          No habits configured yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {heatmap.habits.map((h) => {
            const def = habitsById.get(h.habitDefinitionId);
            if (!def) return null;
            return (
              <HabitHeatmapCard
                key={h.habitDefinitionId}
                habit={h}
                definition={def}
                rangeStart={heatmap.rangeStart}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

type CardProps = {
  habit: HabitHeatmap;
  definition: HabitDefinition;
  rangeStart: string;
};

function HabitHeatmapCard({ habit, definition, rangeStart }: CardProps) {
  const baseColor = definition.positive ? definition.color : NEGATIVE_COLOR;
  const total = habit.days.reduce((s, d) => s + d.count, 0);

  const { weekColumns, max } = useMemo(
    () => buildGrid(habit.days, rangeStart),
    [habit.days, rangeStart],
  );

  // CSS grid: a label column on the left + one column per week, all weeks
  // sharing the remaining width equally (1fr). Cells stay square via
  // aspect-ratio so the grid grows/shrinks with the container.
  const gridStyle = {
    gridTemplateColumns: `auto repeat(${weekColumns.length}, minmax(0, 1fr))`,
    gridTemplateRows: 'repeat(7, auto)',
  } as const;

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-3">
      <div className="flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: baseColor }}
          />
          <h3 className="font-medium">{definition.name}</h3>
        </div>
        <span className="text-xs text-neutral-500">{total} entries</span>
      </div>

      <div
        className="mt-2 grid gap-[3px]"
        style={gridStyle}
        role="grid"
        aria-label={`${definition.name} heatmap`}
      >
        {WEEKDAY_LABELS.map((label, i) => (
          <div
            key={`label-${i}`}
            className="flex items-center pr-1 text-[10px] leading-none text-neutral-500"
            style={{ gridRow: i + 1, gridColumn: 1 }}
            aria-hidden
          >
            {label}
          </div>
        ))}
        {weekColumns.map((col, w) =>
          col.cells.map((cell, d) => (
            <Cell
              key={cell.date}
              date={cell.date}
              count={cell.count}
              max={max}
              color={baseColor}
              gridRow={d + 1}
              gridColumn={w + 2}
            />
          )),
        )}
      </div>
    </div>
  );
}

type Cell = { date: string; count: number };
type WeekColumn = { weekStart: string; cells: Cell[] };

const WEEKS = 26;

function buildGrid(
  days: HabitHeatmap['days'],
  rangeStart: string,
): { weekColumns: WeekColumn[]; max: number } {
  const counts = new Map<string, number>();
  for (const d of days) counts.set(d.date, d.count);

  const weekColumns: WeekColumn[] = [];
  let cursor = rangeStart;
  let max = 0;

  for (let w = 0; w < WEEKS; w++) {
    const cells: Cell[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addDaysIso(cursor, i);
      const count = counts.get(date) ?? 0;
      if (count > max) max = count;
      cells.push({ date, count });
    }
    weekColumns.push({ weekStart: cursor, cells });
    cursor = addDaysIso(cursor, 7);
  }

  return { weekColumns, max };
}

type CellProps = {
  date: string;
  count: number;
  max: number;
  color: string;
  gridRow: number;
  gridColumn: number;
};

function Cell({ date, count, max, color, gridRow, gridColumn }: CellProps) {
  const opacity = bucketOpacity(count, max);
  const fill = count === 0 ? EMPTY_CELL : color;

  return (
    <div
      role="gridcell"
      title={`${date}: ${count}`}
      aria-label={`${date}: ${count} ${count === 1 ? 'entry' : 'entries'}`}
      style={{
        gridRow,
        gridColumn,
        backgroundColor: fill,
        opacity: count === 0 ? 1 : opacity,
        borderRadius: 2,
        aspectRatio: '1 / 1',
        minWidth: 0,
      }}
    />
  );
}

function bucketOpacity(count: number, max: number): number {
  if (count <= 0 || max <= 0) return INTENSITY_OPACITY[0];
  // Map count into 4 buckets above zero.
  const ratio = count / max;
  const bucket = Math.min(4, Math.max(1, Math.ceil(ratio * 4)));
  return INTENSITY_OPACITY[bucket];
}

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}
