import type { QueryClient } from '@tanstack/react-query';
import type { CreateEntryBody } from '@habitsapp/shared';
import { apiFetch, OfflineError } from '@/lib/api';
import { getPendingEntries, removePendingEntry } from './offlineStore';

// The seam `002-entry-sync-protocol.md` will replace with a real push
// protocol, and `003-device-sync-authentication.md` will authenticate. Keep
// it isolated here rather than spread across the mutation hooks.
//
// Sequential by design: ordering will matter once US-004/005 add edits and
// deletes to the same queue. Uses apiFetch directly (not a TanStack mutation)
// so a background drain never hits the global MutationCache.onError toast.
export async function drainPendingEntries(qc: QueryClient): Promise<void> {
  if (!navigator.onLine) return;

  let pushedAny = false;

  for (const record of getPendingEntries()) {
    const body: CreateEntryBody = {
      habitDefinitionId: record.habitDefinitionId,
      userId: record.userId,
      date: record.date,
      data: record.data,
    };
    try {
      await apiFetch('/entries', { method: 'POST', body });
      removePendingEntry(record.localId);
      pushedAny = true;
    } catch (err) {
      if (err instanceof OfflineError) {
        // The connection dropped mid-drain: every remaining item would fail
        // the same way, so stop and let the next trigger retry from here.
        break;
      }
      // A real server answer that isn't success (e.g. its Habit Definition
      // was deleted) — GRISK-001/US-008's problem, not this drain's. Leave it
      // in the store and keep draining the rest; they're independent creates.
    }
  }

  if (pushedAny) {
    qc.invalidateQueries({ queryKey: ['entries'] });
    qc.invalidateQueries({ queryKey: ['metrics'] });
  }
}
