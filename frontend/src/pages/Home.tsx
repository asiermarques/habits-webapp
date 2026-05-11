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

const ALL_HABITS = 'all';

export function Home() {
  const { activeUser } = useUserContext();
  const { data: habits = [] } = useHabitDefinitionsQuery(activeUser?.id ?? 0);
  const { openEdit } = useLogEntryDialog();
  const [filter, setFilter] = useState<string>(ALL_HABITS);

  const sortedHabits = useMemo(
    () => [...habits].sort((a, b) => a.name.localeCompare(b.name)),
    [habits],
  );
  const habitDefinitionId = filter === ALL_HABITS ? undefined : Number(filter);

  return (
    <div className="space-y-6 p-4">
      <div className="flex justify-end">
        <div className="grid">
          <div className="col-start-1 row-start-1">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-full" aria-label="Filter by habit">
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
        </div>
      </div>

      <WeekChartSection habitDefinitionId={habitDefinitionId} />

      <EntriesList habitDefinitionId={habitDefinitionId} onEdit={openEdit} />
    </div>
  );
}
