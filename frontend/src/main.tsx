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
      staleTime: 30_000,
      refetchOnWindowFocus: false,
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
