import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Entry } from '@habitsapp/shared';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useUserContext } from '@/users/UserContext';
import { useHabitDefinitionsQuery } from '@/habits/queries';
import { useSettingsQuery } from '@/settings/queries';
import { EntryForm } from './EntryForm';
import { useCreateEntry, useUpdateEntry } from './queries';

type DialogState = { kind: 'closed' } | { kind: 'log' } | { kind: 'edit'; entry: Entry };

type LogEntryDialogContextValue = {
  openLog: () => void;
  openEdit: (entry: Entry) => void;
  close: () => void;
};

const Ctx = createContext<LogEntryDialogContextValue | null>(null);

export function LogEntryDialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DialogState>({ kind: 'closed' });
  const { activeUser } = useUserContext();
  const { data: habits = [] } = useHabitDefinitionsQuery(activeUser?.id ?? 0);
  const { data: settings } = useSettingsQuery();
  const currency = settings?.currency ?? 'EUR';
  const createEntry = useCreateEntry();
  const updateEntry = useUpdateEntry();

  const close = useCallback(() => setState({ kind: 'closed' }), []);
  const openLog = useCallback(() => setState({ kind: 'log' }), []);
  const openEdit = useCallback((entry: Entry) => setState({ kind: 'edit', entry }), []);

  const value = useMemo<LogEntryDialogContextValue>(
    () => ({ openLog, openEdit, close }),
    [openLog, openEdit, close],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <Dialog open={state.kind !== 'closed'} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{state.kind === 'edit' ? 'Edit entry' : 'Log entry'}</DialogTitle>
          </DialogHeader>

          {state.kind === 'log' && activeUser && (
            <EntryForm
              habits={habits}
              currency={currency}
              pending={createEntry.isPending}
              onSubmit={(values) => {
                createEntry.mutate(
                  { ...values, userId: activeUser.id },
                  { onSuccess: close },
                );
              }}
              onCancel={close}
            />
          )}

          {state.kind === 'edit' && activeUser && (
            <EntryForm
              habits={habits}
              initial={state.entry}
              currency={currency}
              pending={updateEntry.isPending}
              onSubmit={(values) => {
                updateEntry.mutate(
                  { id: state.entry.id, date: values.date, data: values.data },
                  { onSuccess: close },
                );
              }}
              onCancel={close}
            />
          )}
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  );
}

export function useLogEntryDialog() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error('useLogEntryDialog must be used within a LogEntryDialogProvider');
  }
  return ctx;
}
