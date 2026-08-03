import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useUserContext } from '@/users/UserContext';
import { checkDataVersion } from './dataVersion';

// While the app is in the foreground. Long enough that an open desktop tab
// costs one tiny request a minute, short enough that a change made on the
// phone shows up on the desktop without a reload. Backgrounded tabs don't
// poll at all — the visibility check below skips them, and the foreground
// transition covers the catch-up.
const POLL_INTERVAL_MS = 60_000;

// Headless: asks the backend whether anything changed and invalidates the
// affected reads when it has. Mount once near the app root, inside
// UserProvider (it needs the active user) — alongside EntrySync, which is the
// same shape in the other direction: EntrySync pushes local changes out, this
// pulls remote ones in.
//
// This is what pays for the long staleTime on every query. Without it, a
// change made on another device is invisible until something goes stale, so
// either the app refetches on a timer (expensive) or an installed PWA sits on
// old data until a reload it rarely gets.
export function DataVersionSync() {
  const qc = useQueryClient();
  const { activeUser } = useUserContext();
  const userId = activeUser?.id ?? 0;

  useEffect(() => {
    if (userId <= 0) return;

    const check = () => void checkDataVersion(qc, userId);

    check();

    // The moment that actually matters on mobile: returning to the app fires
    // visibilitychange, where a backgrounded PWA remounts nothing and
    // reconnects nothing, so nothing else would prompt a check.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', check);

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') check();
    }, POLL_INTERVAL_MS);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', check);
      window.clearInterval(interval);
    };
  }, [qc, userId]);

  return null;
}
