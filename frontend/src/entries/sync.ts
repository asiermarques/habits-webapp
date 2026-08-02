import type { QueryClient } from '@tanstack/react-query';
import type { CreateEntryBody, UpdateEntryBody } from '@habitsapp/shared';
import { apiFetch, OfflineError } from '@/lib/api';
import { getPendingEntries, getPendingOps, removePendingEntry, removePendingOp } from './offlineStore';

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
  let droppedOffline = false;

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
        droppedOffline = true;
        break;
      }
      // A real server answer that isn't success (e.g. its Habit Definition
      // was deleted) — GRISK-001/US-008's problem, not this drain's. Leave it
      // in the store and keep draining the rest; they're independent creates.
    }
  }

  // Ops target Entries that already have a server id, independent of any
  // create above, so there's no ordering requirement between the two loops
  // (US-004's ordering note is about a create and its own edits, which never
  // produce a separate op — see amendPendingEntryCreate).
  if (!droppedOffline) {
    for (const op of getPendingOps()) {
      try {
        if (op.kind === 'update') {
          const body: UpdateEntryBody = { date: op.date, data: op.data };
          await apiFetch(`/entries/${op.entryId}`, { method: 'PUT', body });
        } else {
          await apiFetch(`/entries/${op.entryId}`, { method: 'DELETE' });
        }
        removePendingOp(op.entryId);
        pushedAny = true;
      } catch (err) {
        if (err instanceof OfflineError) break;
        // Server-rejected — leave it queued and keep draining the rest.
      }
    }
  }

  if (pushedAny) {
    qc.invalidateQueries({ queryKey: ['entries'] });
    qc.invalidateQueries({ queryKey: ['metrics'] });
  }
}
