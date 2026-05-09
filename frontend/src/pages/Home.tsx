import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import type { Entry } from '@habitsapp/shared';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUserContext } from '@/users/UserContext';
import { useHabitDefinitionsQuery } from '@/habits/queries';
import { EntryForm } from '@/entries/EntryForm';
import { EntriesList } from '@/entries/EntriesList';
import { useCreateEntry, useUpdateEntry } from '@/entries/queries';
import { WeekChartSection } from '@/metrics/WeekChartSection';

type DialogState = { kind: 'closed' } | { kind: 'log' } | { kind: 'edit'; entry: Entry };

const ALL_HABITS = 'all';

export function Home() {
  const { activeUser } = useUserContext();
  const { data: habits = [] } = useHabitDefinitionsQuery();
  const createEntry = useCreateEntry();
  const updateEntry = useUpdateEntry();
  const [dialog, setDialog] = useState<DialogState>({ kind: 'closed' });
  const [filter, setFilter] = useState<string>(ALL_HABITS);

  const closeDialog = () => setDialog({ kind: 'closed' });

  const sortedHabits = useMemo(
    () => [...habits].sort((a, b) => a.name.localeCompare(b.name)),
    [habits],
  );
  const habitDefinitionId = filter === ALL_HABITS ? undefined : Number(filter);

  return (
    <div className="space-y-6 p-4">
      <Button
        size="lg"
        className="w-full"
        onClick={() => setDialog({ kind: 'log' })}
        disabled={!activeUser || habits.length === 0}
      >
        <Plus className="h-5 w-5" />
        Log entry
      </Button>

      <div className="flex justify-end">
        <div className="w-44">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger aria-label="Filter by habit">
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

      <WeekChartSection habitDefinitionId={habitDefinitionId} />

      <EntriesList
        habitDefinitionId={habitDefinitionId}
        onEdit={(entry) => setDialog({ kind: 'edit', entry })}
      />

      <Dialog open={dialog.kind !== 'closed'} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog.kind === 'edit' ? 'Edit entry' : 'Log entry'}</DialogTitle>
          </DialogHeader>

          {dialog.kind === 'log' && activeUser && (
            <EntryForm
              habits={habits}
              pending={createEntry.isPending}
              onSubmit={(values) => {
                createEntry.mutate(
                  { ...values, userId: activeUser.id },
                  { onSuccess: closeDialog },
                );
              }}
              onCancel={closeDialog}
            />
          )}

          {dialog.kind === 'edit' && activeUser && (
            <EntryForm
              habits={habits}
              initial={dialog.entry}
              pending={updateEntry.isPending}
              onSubmit={(values) => {
                updateEntry.mutate(
                  { id: dialog.entry.id, date: values.date, data: values.data },
                  { onSuccess: closeDialog },
                );
              }}
              onCancel={closeDialog}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
