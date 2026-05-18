import { useMemo, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import type { CurrencyCode, Entry, HabitDefinition } from '@habitsapp/shared';
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
import { useSettingsQuery } from '@/settings/queries';
import { formatCurrency } from '@/lib/currency';
import { t } from '@/lib/i18n';
import { useDeleteEntry, useEntriesInfinite } from './queries';
import { formatDate } from './date';

type EntriesListProps = {
  onEdit: (entry: Entry) => void;
  habitDefinitionId?: number;
};

export function EntriesList({ onEdit, habitDefinitionId }: EntriesListProps) {
  const { activeUser } = useUserContext();
  const { data: habits = [] } = useHabitDefinitionsQuery(activeUser?.id ?? 0);
  const { data: settings } = useSettingsQuery();
  const currency = settings?.currency ?? 'EUR';
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
      <p className="text-sm text-ink-soft">{t('entries.noUser')}</p>
    );
  }

  const entries = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <section className="space-y-3">
      {isFetching && entries.length === 0 && (
        <p className="text-sm text-ink-soft">{t('action.loading')}</p>
      )}

      {!isFetching && entries.length === 0 && (
        <p className="rounded-md border border-dashed border-hairline p-4 text-center text-sm text-ink-soft">
          {t('entries.empty')}
        </p>
      )}

      <ul className="space-y-2">
        {entries.map((entry) => (
          <EntryCard
            key={entry.id}
            entry={entry}
            habit={habitsById.get(entry.habitDefinitionId)}
            currency={currency}
            onEdit={() => onEdit(entry)}
            onDelete={() => setPendingDelete(entry)}
          />
        ))}
      </ul>

      {hasNextPage && (
        <div className="flex items-center gap-3 pt-2">
          <div className="h-px flex-1 bg-hairline" />
          <button
            type="button"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft transition hover:text-moss-deep disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isFetchingNextPage ? t('action.loading') : t('entries.seeMore')}
          </button>
          <div className="h-px flex-1 bg-hairline" />
        </div>
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('entries.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('action.cantUndo')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('action.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) deleteEntry.mutate(pendingDelete.id);
                setPendingDelete(null);
              }}
              className="bg-ember hover:bg-ember/90"
            >
              {t('action.delete')}
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
  currency: CurrencyCode;
  onEdit: () => void;
  onDelete: () => void;
};

function EntryCard({ entry, habit, currency, onEdit, onDelete }: EntryCardProps) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-hairline bg-card px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: habit?.color ?? 'var(--ink-faint)' }}
          />
          <span className="truncate font-medium">{habit?.name ?? t('entries.unknownHabit')}</span>
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.15em] text-ink-faint">
            {entry.type}
          </span>
        </div>
        <EntrySummary entry={entry} currency={currency} />
      </div>
      <div className="flex shrink-0 items-center">
        <Button size="icon" variant="ghost" onClick={onEdit} aria-label={t('entries.editAria')}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={onDelete}
          aria-label={t('entries.deleteAria')}
          className="text-ember hover:text-ember/80"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
}

function EntrySummary({ entry, currency }: { entry: Entry; currency: CurrencyCode }) {
  const parts: string[] = [];
  const d = entry.data as Record<string, unknown>;

  if (entry.type === 'workout') {
    if (typeof d.duration === 'number') parts.push(`${d.duration} ${t('unit.min')}`);
    if (typeof d.distance === 'number') parts.push(`${d.distance} ${t('unit.km')}`);
    if (typeof d.weight === 'number') parts.push(`${d.weight} ${t('unit.kg')}`);
    if (typeof d.number === 'number') parts.push(`${d.number} ${t('unit.reps')}`);
  } else if (entry.type === 'writing') {
    if (typeof d.words === 'number') parts.push(`${d.words} ${t('unit.words')}`);
    if (typeof d.time === 'number') parts.push(`${d.time} ${t('unit.min')}`);
  } else {
    if (typeof d.number === 'number') parts.push(`${d.number} ${t('unit.reps')}`);
    if (typeof d.amount === 'number') parts.push(`${t('unit.cost')} ${formatCurrency(d.amount, currency)}`);
    if (typeof d.duration === 'number') parts.push(`${d.duration} ${t('unit.min')}`);
  }

  const date = formatDate(entry.date);
  const sep = t('unit.separator');
  const text = parts.length > 0 ? `${date} → ${parts.join(sep)}` : date;

  return <p className="mt-0.5 truncate text-sm text-ink-soft">{text}</p>;
}
