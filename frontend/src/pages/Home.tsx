import { useMemo, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUserContext } from '@/users/UserContext';
import { useHabitDefinitionsQuery } from '@/habits/queries';
import { EntriesList } from '@/entries/EntriesList';
import { useLogEntryDialog } from '@/entries/LogEntryDialog';
import { WeekChartSection } from '@/metrics/WeekChartSection';
import { useByHabitMetrics } from '@/metrics/queries';

const ALL_HABITS = 'all';

export function Home() {
  const { activeUser } = useUserContext();
  const { data: habits = [] } = useHabitDefinitionsQuery(activeUser?.id ?? 0);
  const { data: byHabit } = useByHabitMetrics(activeUser?.id ?? 0);
  const { openEdit } = useLogEntryDialog();
  const [filter, setFilter] = useState<string>(ALL_HABITS);

  const sortedHabits = useMemo(() => {
    const counts = new Map<number, number>();
    for (const week of byHabit?.weeks ?? []) {
      for (const h of week.habits) {
        counts.set(h.habitDefinitionId, (counts.get(h.habitDefinitionId) ?? 0) + h.count);
      }
    }
    return [...habits].sort((a, b) => {
      const diff = (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0);
      return diff !== 0 ? diff : a.name.localeCompare(b.name);
    });
  }, [habits, byHabit]);
  const habitDefinitionId = filter === ALL_HABITS ? undefined : Number(filter);
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="mx-auto max-w-2xl space-y-10 py-8 rise">
      <section className="space-y-3">
        <p className="eyebrow">{today}</p>
        <div className="flex items-end justify-between gap-4">
          <h1 className="font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl">
            {activeUser ? (
              <>
                Hello,{' '}
                <span className="italic text-moss-deep">{activeUser.name}</span>.
              </>
            ) : (
              <>A quiet ledger of small acts.</>
            )}
          </h1>
        </div>
        <p className="max-w-md text-[0.95rem] leading-relaxed text-ink-soft">
          Mark what you did. Not what you should have done.
        </p>
      </section>

      <div className="flex items-center justify-between gap-3">
        <span className="eyebrow">this week</span>
        <div className="h-px flex-1 bg-hairline" />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger
            className="h-9 w-auto min-w-[10rem] rounded-full border-hairline text-sm shadow-none"
            aria-label="Filter by habit"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_HABITS}>All habits</SelectItem>
            {sortedHabits.map((h) => (
              <SelectItem key={h.id} value={String(h.id)}>
                {h.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <WeekChartSection habitDefinitionId={habitDefinitionId} />

      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="eyebrow">recent entries</span>
          <div className="h-px flex-1 bg-hairline" />
        </div>
        <EntriesList habitDefinitionId={habitDefinitionId} onEdit={openEdit} />
      </section>
    </div>
  );
}
