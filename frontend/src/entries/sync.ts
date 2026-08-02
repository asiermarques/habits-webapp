import type { QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { CreateEntryBody, UpdateEntryBody } from '@habitsapp/shared';
import { apiFetch, ApiError, OfflineError } from '@/lib/api';
import { getPendingEntries, getPendingOps, removePendingEntry, removePendingOp } from './offlineStore';
import { recordDrainFailure, recordDrainSuccess } from './syncStatus';
import { gateKey } from '@/gate/queries';
import { t } from '@/lib/i18n';

// What to do with an item a drain attempt couldn't push, decided by what
// apiFetch threw (US-007/US-008/US-010's shared seam):
//  - OfflineError: the network is away, not a rejection. Stop the whole drain
//    (every remaining item would fail the same way) and don't touch the
//    failure streak — offline is the expected state, not a failure.
//  - ApiError 401: the gate session expired mid-drain. Re-check gate status
//    (routes into the existing GateGuard re-lock path, US-010) rather than
//    treating this as a rejected Entry or a failing sync.
//  - ApiError 4xx (any other status): the server is refusing this item on its
//    merits (e.g. its Habit Definition was deleted, EDGE-002) and retrying
//    the same payload would fail the same way forever. Discard it and tell
//    the user (US-008, OQ-001) rather than let it poison the rest of the
//    backlog or the failing-state threshold.
//  - anything else (5xx, unexpected): a genuine transient failure. Leave it
//    queued and count it toward the failing-state threshold (US-007).
type DrainOutcome = 'continue' | 'continue-failure' | 'stop-offline' | 'stop-unauthenticated';

function handleDrainError(err: unknown, qc: QueryClient, discard: () => void, describe: () => string): DrainOutcome {
  if (err instanceof OfflineError) return 'stop-offline';
  if (err instanceof ApiError && err.status === 401) {
    qc.invalidateQueries({ queryKey: gateKey() });
    return 'stop-unauthenticated';
  }
  if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
    discard();
    toast.error(t('sync.rejected', { entry: describe(), reason: err.message }));
    return 'continue';
  }
  return 'continue-failure';
}

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
  let stopped = false;
  let hadFailure = false;

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
      const outcome = handleDrainError(
        err,
        qc,
        () => removePendingEntry(record.localId),
        () => t(`habitType.${record.type}`),
      );
      if (outcome === 'continue-failure') hadFailure = true;
      if (outcome === 'stop-offline' || outcome === 'stop-unauthenticated') {
        stopped = true;
        break;
      }
    }
  }

  // Ops target Entries that already have a server id, independent of any
  // create above, so there's no ordering requirement between the two loops
  // (US-004's ordering note is about a create and its own edits, which never
  // produce a separate op — see amendPendingEntryCreate).
  if (!stopped) {
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
        const outcome = handleDrainError(
          err,
          qc,
          () => removePendingOp(op.entryId),
          () => (op.kind === 'delete' ? t(`habitType.${op.type}`) : t('sync.entryFallback')),
        );
        if (outcome === 'continue-failure') hadFailure = true;
        if (outcome === 'stop-offline' || outcome === 'stop-unauthenticated') {
          stopped = true;
          break;
        }
      }
    }
  }

  if (pushedAny) {
    qc.invalidateQueries({ queryKey: ['entries'] });
    qc.invalidateQueries({ queryKey: ['metrics'] });
  }

  // A run that hit at least one transient failure (5xx, or anything else
  // that isn't a network drop, a 401, or an unfixable 4xx) counts toward the
  // failing-state threshold (US-007). A run that completed clean — pushed
  // everything, found items already discarded, or had nothing to do — resets
  // it, which is what keeps a single transient error from ever showing as
  // failing once the next drain succeeds.
  if (stopped) {
    // Offline / 401: neither a success nor a failure — leave the streak as is.
  } else if (hadFailure) {
    recordDrainFailure();
  } else {
    recordDrainSuccess();
  }
}
