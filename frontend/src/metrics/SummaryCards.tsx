import { useMemo } from 'react';
import type { HabitCount, HabitDefinition } from '@habitsapp/shared';
import { useUserContext } from '@/users/UserContext';
import { useHabitDefinitionsQuery } from '@/habits/queries';
import { useSettingsQuery } from '@/settings/queries';
import { formatCurrency } from '@/lib/currency';
import { useSummaryMetrics } from './queries';

export function SummaryCards() {
  const { activeUser } = useUserContext();
  const userId = activeUser?.id ?? 0;
  const { data: habits = [] } = useHabitDefinitionsQuery(userId);
  const { data, isLoading } = useSummaryMetrics(userId);
  const { data: settings } = useSettingsQuery();
  const currency = settings?.currency ?? 'EUR';

  const habitsById = useMemo(
    () => new Map(habits.map((h) => [h.id, h])),
    [habits],
  );

  if (!activeUser) return null;

  const periodLabel = data ? formatPeriod(data.rangeStart, data.rangeEnd) : null;

  return (
    <section className="space-y-4">
      <div className="flex items-baseline gap-3">
        <span className="eyebrow">last 30 days</span>
        <div className="h-px flex-1 bg-hairline" />
        {periodLabel && (
          <span className="font-mono text-[11px] tracking-wider text-ink-faint">
            {periodLabel}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      <ScoreCard
        label="Most logged"
        habit={data?.mostRegistered}
        habitsById={habitsById}
        loading={isLoading}
      />
      <ScoreCard
        label="Least logged"
        habit={data?.leastRegistered}
        habitsById={habitsById}
        loading={isLoading}
      />
      <ScoreCard
        label="Bad habit total cost"
        display={
          data === undefined
            ? undefined
            : formatCurrency(data.badHabitsTotalCost, currency)
        }
        loading={isLoading}
        tone={data && data.badHabitsTotalCost > 0 ? 'ember' : undefined}
      />
      <ScoreCard
        label="Active habits"
        value={data?.activeHabitsCount}
        hint={habits.length > 0 ? `of ${habits.length}` : undefined}
        loading={isLoading}
        tone={data && data.activeHabitsCount > 0 ? 'moss' : undefined}
      />
      </div>
    </section>
  );
}

function formatPeriod(rangeStart: string, rangeEnd: string): string {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  };
  return `${fmt(rangeStart)} — ${fmt(rangeEnd)}`;
}

type ScoreCardProps = {
  label: string;
  loading?: boolean;
  // Habit-flavored cards take a HabitCount + lookup map.
  habit?: HabitCount | null;
  habitsById?: Map<number, HabitDefinition>;
  // Value-flavored cards take either a numeric `value` or a pre-formatted
  // `display` string (used for currency-formatted amounts).
  value?: number;
  display?: string;
  hint?: string;
  tone?: Tone;
};

type Tone = 'ember' | 'moss';

const TONE_VALUE_CLASS: Record<Tone, string> = {
  ember: 'text-ember',
  moss: 'text-moss-deep',
};

function ScoreCard({ label, loading, habit, habitsById, value, display, hint, tone }: ScoreCardProps) {
  const isHabitCard = habit !== undefined || habitsById !== undefined;
  const toneClass = tone ? TONE_VALUE_CLASS[tone] : undefined;

  return (
    <div className="rounded-md border border-hairline bg-card p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-ink-soft">
        {label}
      </div>
      <div className="mt-1 min-h-[2.25rem]">
        {loading ? (
          <span className="text-sm text-ink-faint">…</span>
        ) : isHabitCard ? (
          <HabitCardBody habit={habit ?? null} habitsById={habitsById ?? new Map()} />
        ) : (
          <ValueCardBody display={display ?? String(value ?? 0)} hint={hint} toneClass={toneClass} />
        )}
      </div>
    </div>
  );
}

function HabitCardBody({
  habit,
  habitsById,
}: {
  habit: HabitCount | null;
  habitsById: Map<number, HabitDefinition>;
}) {
  if (!habit) {
    return <span className="text-sm text-ink-faint">—</span>;
  }
  const def = habitsById.get(habit.habitDefinitionId);
  return (
    <>
      <div className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="inline-block h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: def?.color ?? '#999' }}
        />
        <span className="truncate text-sm font-semibold">
          {def?.name ?? 'Unknown'}
        </span>
      </div>
      <div className="mt-0.5 text-xs text-ink-soft">{habit.count} reps</div>
    </>
  );
}

function ValueCardBody({
  display,
  hint,
  toneClass,
}: {
  display: string;
  hint?: string;
  toneClass?: string;
}) {
  return (
    <>
      <div className={`text-xl font-semibold tabular-nums ${toneClass ?? ''}`}>
        {display}
      </div>
      {hint && <div className="text-xs text-ink-soft">{hint}</div>}
    </>
  );
}
