import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { drainPendingEntries } from './sync';

// "Periodically while online" (requisites ASM-004, left unquantified) — 30s
// keeps a backlog moving without hammering the API.
const DRAIN_INTERVAL_MS = 30_000;

// Headless: drains pending Entry changes on mount (app-start drain, requisites
// FR-007), on the browser's online transition, and on an interval while
// mounted. Mount once near the app root, alongside PwaUpdatePrompt/InstallPrompt.
export function EntrySync() {
  const qc = useQueryClient();

  useEffect(() => {
    void drainPendingEntries(qc);

    const onOnline = () => void drainPendingEntries(qc);
    window.addEventListener('online', onOnline);
    const interval = window.setInterval(() => void drainPendingEntries(qc), DRAIN_INTERVAL_MS);

    return () => {
      window.removeEventListener('online', onOnline);
      window.clearInterval(interval);
    };
  }, [qc]);

  return null;
}
