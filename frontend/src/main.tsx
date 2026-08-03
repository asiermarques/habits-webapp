import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import { App } from './App';
import { ApiError, OfflineError } from './lib/api';
import { gateKey } from './gate/queries';
import { t } from './lib/i18n';
import './index.css';

// A 401 means the instance gate locked us out (e.g. the session expired). Rather
// than toasting a generic error, re-check the gate status so GateGuard can show
// the unlock screen. An OfflineError means the request never reached the server,
// so we say so plainly (US-004) — a mutation attempted offline failed and was
// not saved. All other errors surface their message as a toast, as before.
function handleError(error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    queryClient.invalidateQueries({ queryKey: gateKey() });
    return;
  }
  if (error instanceof OfflineError) {
    toast.error(t('error.offline'));
    return;
  }
  toast.error(error instanceof Error ? error.message : 'Request failed');
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Long, and uniform on purpose. Staleness here doesn't mean "this might
      // be out of date": local writes invalidate their own keys, and a change
      // made on another device is caught by DataVersionSync, which asks the
      // backend for a change token and invalidates only when it actually
      // moved. So this is a *backstop* — it bounds how long the app could sit
      // on old data if that check were failing silently — not the convergence
      // mechanism. A short value here buys nothing but periodic refetches of
      // data that hasn't changed, which is what 30s across the board was
      // doing: revalidating most of the app on every navigation.
      staleTime: 30 * 60_000,
      // Pairs with the backstop above: on the one event an installed PWA
      // reliably reaches — returning to the foreground — revalidate whatever
      // has aged past it. Free on a quick app switch, since a refetch on focus
      // only touches queries that are already stale.
      refetchOnWindowFocus: true,
      // Retries that can't succeed only add latency. Offline (the request never
      // reached the server) and client errors (4xx — a locked gate's 401, a
      // validation 400) won't recover by retrying, so bail immediately. This
      // matters most for the gate status call (excluded from the SW cache by
      // RISK-G1): without this, an offline refresh retried it 3× over ~7s while
      // GateGuard rendered nothing, so the cached shell appeared to hang before
      // the offline fallback kicked in. Transient/5xx errors still retry.
      retry: (failureCount, error) => {
        if (error instanceof OfflineError) return false;
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          return false;
        }
        return failureCount < 3;
      },
    },
  },
  queryCache: new QueryCache({ onError: handleError }),
  mutationCache: new MutationCache({ onError: handleError }),
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
