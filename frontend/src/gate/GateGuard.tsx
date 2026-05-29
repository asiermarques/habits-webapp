import { useEffect, type ReactNode } from 'react';
import { GateScreen } from './GateScreen';
import { useGateStatus } from './queries';
import { rememberGated, wasGated } from './storage';

// Wraps the app shell. While the gate status is unknown it renders nothing
// (a call that resolves quickly online); once known it either shows the unlock
// screen (gated + locked) or the app. Mount this above the feature providers so
// their queries don't fire — and 401 — while the instance is locked.
//
// Offline (the status call can't reach the server) we fall back to the last
// known gated flag: fail closed for instances we knew to be gated so
// service-worker-cached data is never shown without a fresh unlock (RISK-G1),
// and let known-open instances through so the offline shell still works.
export function GateGuard({ children }: { children: ReactNode }) {
  const { data, isLoading } = useGateStatus();

  useEffect(() => {
    if (data) rememberGated(data.gated);
  }, [data]);

  if (data) {
    if (data.gated && !data.authenticated) return <GateScreen />;
    return <>{children}</>;
  }

  if (isLoading) return null;

  return wasGated() ? <GateScreen /> : <>{children}</>;
}
