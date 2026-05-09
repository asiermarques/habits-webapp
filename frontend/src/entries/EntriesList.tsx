import { useMemo, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import type { Entry, HabitDefinition } from '@habitsapp/shared';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useUserContext } from '@/users/UserContext';
import { useHabitDefinitionsQuery } from '@/habits/queries';
import { useDeleteEntry, useEntriesInfinite } from './queries';
import { formatDate } from './date';

type EntriesListProps = {
  onEdit: (entry: Entry) => void;
  habitDefinitionId?: number;
};

export function EntriesList({ onEdit, habitDefinitionId }: EntriesListProps) {
  const { activeUser } = useUserContext();
  const { data: habits = [] } = useHabitDefinitionsQuery();
  const [pendingDelete, setPendingDelete] = useState<Entry | null>(null);
  const deleteEntry = useDeleteEntry();

  const habitsById = useMemo(() => new Map(habits.map((h) => [h.id, h])), [habits]);

  const { data, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage } =
    useEntriesInfinite({
      userId: activeUser?.id ?? 0,
      habitDefinitionId,
    });

  if (!activeUser) {
    return (
      <p className="text-sm text-neutral-500">Add a user in Settings to start logging.</p>
    );
  }

  const entries = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Recent entries</h2>

      {isFetching && entries.length === 0 && (
        <p className="text-sm text-neutral-500">Loading…</p>
      )}

      {!isFetching && entries.length === 0 && (
        <p className="rounded-md border border-dashed border-neutral-300 p-4 text-center text-sm text-neutral-500">
          No entries yet. Tap “Log” above to add your first.
        </p>
      )}

      <ul className="space-y-2">
        {entries.map((entry) => (
          <EntryCard
            key={entry.id}
            entry={entry}
            habit={habitsById.get(entry.habitDefinitionId)}
            onEdit={() => onEdit(entry)}
            onDelete={() => setPendingDelete(entry)}
          />
        ))}
      </ul>

      {hasNextPage && (
        <div className="flex justify-center pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) deleteEntry.mutate(pendingDelete.id);
                setPendingDelete(null);
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

type EntryCardProps = {
  entry: Entry;
  habit?: HabitDefinition;
  onEdit: () => void;
  onDelete: () => void;
};

function EntryCard({ entry, habit, onEdit, onDelete }: EntryCardProps) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 bg-white px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: habit?.color ?? '#999' }}
          />
          <span className="truncate font-medium">{habit?.name ?? 'Unknown habit'}</span>
          <span className="ml-auto shrink-0 text-xs text-neutral-500">
            {formatDate(entry.date)}
          </span>
        </div>
        <EntrySummary entry={entry} />
      </div>
      <div className="flex shrink-0 items-center">
        <Button size="icon" variant="ghost" onClick={onEdit} aria-label="Edit entry">
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={onDelete}
          aria-label="Delete entry"
          className="text-red-600 hover:text-red-700"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
}

function EntrySummary({ entry }: { entry: Entry }) {
  const parts: string[] = [];
  const d = entry.data as Record<string, unknown>;

  if (entry.type === 'workout') {
    if (typeof d.duration === 'number') parts.push(`${d.duration} min`);
    if (typeof d.distance === 'number') parts.push(`${d.distance} km`);
    if (typeof d.weight === 'number') parts.push(`${d.weight} kg`);
    if (typeof d.amount === 'number') parts.push(`× ${d.amount}`);
  } else if (entry.type === 'writing') {
    if (typeof d.words === 'number') parts.push(`${d.words} words`);
    if (typeof d.time === 'number') parts.push(`${d.time} min`);
  } else {
    if (typeof d.number === 'number') parts.push(`#${d.number}`);
    if (typeof d.amount === 'number') parts.push(`amount ${d.amount}`);
    if (typeof d.duration === 'number') parts.push(`${d.duration} min`);
    if (d.binary === true) parts.push('done');
  }

  if (parts.length === 0) return null;
  return (
    <p className="mt-0.5 truncate text-sm text-neutral-600">{parts.join(' · ')}</p>
  );
}
