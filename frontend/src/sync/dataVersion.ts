import type { QueryClient } from '@tanstack/react-query';
import type { DataVersionResponse } from '@habitsapp/shared';
import { apiFetch } from '@/lib/api';

// Query key roots the backend's change token speaks for. The gate is absent on
// purpose: it isn't data, it changes only via login/logout or a 401, and each
// of those already invalidates it — re-checking it here would just add a
// request to every foreground.
const VERSIONED_KEYS = ['users', 'settings', 'habit-definitions', 'entries', 'metrics'] as const;

// Last token seen per user. Per user because the token covers "this user's data
// plus the instance-wide bits", so switching users starts a fresh baseline
// rather than comparing two unrelated tokens and refetching for nothing.
const lastSeen = new Map<number, string>();

// Exported for tests; also the right thing to call if a user is deleted.
export function forgetDataVersion(userId?: number): void {
  if (userId === undefined) lastSeen.clear();
  else lastSeen.delete(userId);
}

// Ask the backend whether anything changed and, if so, invalidate the reads it
// speaks for. This is the mechanism that lets every query hold a long
// staleTime: convergence comes from one small request that usually answers
// "nothing changed", instead of periodically refetching entries and metrics on
// the chance that they did.
//
// Uses apiFetch directly rather than a useQuery, for the same reason
// drainPendingEntries does: it's a background signal, never rendered, and a
// failure must stay silent. Routing it through TanStack Query would put every
// offline foreground through the global QueryCache.onError toast.
export async function checkDataVersion(qc: QueryClient, userId: number): Promise<void> {
  if (userId <= 0 || !navigator.onLine) return;

  let version: string;
  try {
    ({ version } = await apiFetch<DataVersionResponse>(`/sync/version?userId=${userId}`));
  } catch {
    // Offline, gate expired, server down — all handled elsewhere (the drain's
    // 401 path re-checks the gate; queries surface their own errors). A missed
    // check just means convergence waits for the next one, or for staleTime.
    return;
  }

  const previous = lastSeen.get(userId);
  lastSeen.set(userId, version);

  // First check for this user establishes the baseline. Invalidating here
  // would refetch data the app has just loaded, every single cold start.
  if (previous === undefined || previous === version) return;

  for (const key of VERSIONED_KEYS) {
    qc.invalidateQueries({ queryKey: [key] });
  }
}
