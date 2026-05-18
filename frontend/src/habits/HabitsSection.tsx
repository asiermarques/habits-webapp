import { useState } from 'react';
import { Pencil, Trash2, Plus } from 'lucide-react';
import {
  HABIT_TYPES,
  type HabitDefinition,
  type HabitType,
} from '@habitsapp/shared';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { t } from '@/lib/i18n';
import { HabitForm } from './HabitForm';
import {
  useCreateHabitDefinition,
  useDeleteHabitDefinition,
  useHabitDefinitionsQuery,
  useUpdateHabitDefinition,
} from './queries';

function getTypeLabels(): Record<HabitType, string> {
  return {
    workout: t('habitType.workout'),
    writing: t('habitType.writing'),
    custom: t('habitType.custom'),
  };
}

type DialogState =
  | { kind: 'closed' }
  | { kind: 'add' }
  | { kind: 'edit'; habit: HabitDefinition };

export function HabitsSection() {
  const { activeUser } = useUserContext();
  const userId = activeUser?.id ?? 0;
  const { data: habits = [], isLoading } = useHabitDefinitionsQuery(userId);
  const createHabit = useCreateHabitDefinition(userId);
  const updateHabit = useUpdateHabitDefinition(userId);
  const deleteHabit = useDeleteHabitDefinition(userId);
  const [dialog, setDialog] = useState<DialogState>({ kind: 'closed' });
  const [pendingDelete, setPendingDelete] = useState<HabitDefinition | null>(null);

  const typeLabels = getTypeLabels();
  const grouped = HABIT_TYPES.map((type) => ({
    type,
    items: habits.filter((h) => h.type === type),
  }));

  const closeDialog = () => setDialog({ kind: 'closed' });

  if (!activeUser) {
    return (
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">{t('settings.habits.title')}</h2>
        <p className="text-sm text-ink-soft">{t('settings.habits.noUser')}</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{t('settings.habits.title')}</h2>
          <p className="text-sm text-ink-soft">
            {t('settings.habits.perUser')} <span className="font-medium">{activeUser.name}</span>. {t('settings.habits.perUserSuffix')}
          </p>
        </div>
        <Button size="sm" onClick={() => setDialog({ kind: 'add' })}>
          <Plus className="h-4 w-4" />
          {t('settings.habits.new')}
        </Button>
      </header>

      {isLoading && <p className="text-sm text-ink-soft">{t('settings.habits.loading')}</p>}

      {!isLoading && habits.length === 0 && (
        <p className="text-sm text-ink-soft">{t('settings.habits.empty')}</p>
      )}

      <div className="space-y-6">
        {grouped.map(({ type, items }) =>
          items.length === 0 ? null : (
            <div key={type}>
              <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-ink-soft">
                {typeLabels[type]}
              </h3>
              <ul className="divide-y divide-hairline rounded-md border border-hairline bg-card">
                {items.map((habit) => (
                  <HabitRow
                    key={habit.id}
                    habit={habit}
                    onEdit={() => setDialog({ kind: 'edit', habit })}
                    onDelete={() => setPendingDelete(habit)}
                    deletePending={deleteHabit.isPending}
                  />
                ))}
              </ul>
            </div>
          ),
        )}
      </div>

      <Dialog open={dialog.kind !== 'closed'} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog.kind === 'edit' ? t('settings.habits.editTitle') : t('settings.habits.newTitle')}
            </DialogTitle>
            <DialogDescription>
              {dialog.kind === 'edit'
                ? t('settings.habits.editDescription')
                : `${t('settings.habits.newDescription')} ${activeUser.name}.`}
            </DialogDescription>
          </DialogHeader>

          {dialog.kind === 'add' && (
            <HabitForm
              submitLabel={t('settings.habits.addSubmit')}
              pending={createHabit.isPending}
              onSubmit={(values) => {
                createHabit.mutate(values, { onSuccess: closeDialog });
              }}
              onCancel={closeDialog}
            />
          )}

          {dialog.kind === 'edit' && (
            <HabitForm
              initial={dialog.habit}
              submitLabel={t('action.save')}
              typeLocked={dialog.habit.hasEntries}
              pending={updateHabit.isPending}
              onSubmit={(values) => {
                updateHabit.mutate(
                  { id: dialog.habit.id, ...values },
                  { onSuccess: closeDialog },
                );
              }}
              onCancel={closeDialog}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('settings.habits.deleteTitle', { name: pendingDelete?.name ?? '' })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.hasEntries
                ? t('settings.habits.deleteBlocked')
                : t('action.cantUndo')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('action.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) deleteHabit.mutate(pendingDelete.id);
                setPendingDelete(null);
              }}
              disabled={pendingDelete?.hasEntries}
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

type HabitRowProps = {
  habit: HabitDefinition;
  onEdit: () => void;
  onDelete: () => void;
  deletePending: boolean;
};

function HabitRow({ habit, onEdit, onDelete, deletePending }: HabitRowProps) {
  return (
    <li className="flex items-center justify-between gap-2 px-3 py-2">
      <span className="flex items-center gap-3 truncate">
        <span
          aria-hidden
          className="inline-block h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: habit.color }}
        />
        <span className="truncate">{habit.name}</span>
        {!habit.positive && (
          <span className="rounded-full bg-ember-tint px-2 py-0.5 text-xs font-medium text-ember">
            {t('settings.habits.negative')}
          </span>
        )}
      </span>

      <div className="flex shrink-0 items-center gap-1">
        <Button size="icon" variant="ghost" onClick={onEdit} aria-label={`${t('settings.habits.edit')} ${habit.name}`}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={onDelete}
          disabled={deletePending}
          aria-label={`${t('action.delete')} ${habit.name}`}
          className="text-ember hover:text-ember/80"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
}
