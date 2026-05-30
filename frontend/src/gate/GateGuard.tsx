import { useEffect, type ReactNode } from 'react';
import { GateScreen } from './GateScreen';
import { useGateStatus } from './queries';
import { lastKnownGate, rememberGate } from './storage';

// How long after the last online unlock a gated instance still opens offline.
// Within this window GateGuard trusts the last known authenticated snapshot so
// service-worker-cached reads stay available on a flaky connection; past it we
// fail closed and require a fresh online unlock (RISK-G1). Configurable via
// the GATE_OFFLINE_GRACE_MINUTES env var (defaults to 120 = 2h); a missing,
// non-numeric or non-positive value falls back to the default. The name is
// deliberately un-prefixed — vite.config.ts exposes it through `define`.
const DEFAULT_GRACE_MINUTES = 120;

export function offlineGraceMs(): number {
  const raw = Number(import.meta.env.GATE_OFFLINE_GRACE_MINUTES);
  const minutes = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_GRACE_MINUTES;
  return minutes * 60 * 1000;
}

const OFFLINE_GRACE_MS = offlineGraceMs();

// Wraps the app shell. While the gate status is unknown it renders nothing
// (a call that resolves quickly online); once known it either shows the unlock
// screen (gated + locked) or the app. Mount this above the feature providers so
// their queries don't fire — and 401 — while the instance is locked.
//
// Offline (the status call can't reach the server) we fall back to the last
// known snapshot. Open or unknown instances pass through so the offline shell
// works. A gated instance opens only if we were authenticated online within
// OFFLINE_GRACE_MS; past that window we fail closed so service-worker-cached
// data is never shown stale without a fresh unlock (RISK-G1).
export function GateGuard({ children }: { children: ReactNode }) {
  const { data, isLoading } = useGateStatus();

  useEffect(() => {
    if (data) rememberGate(data);
  }, [data]);

  if (data) {
    if (data.gated && !data.authenticated) return <GateScreen />;
    return <>{children}</>;
  }

  if (isLoading) return null;

  const last = lastKnownGate();
  if (!last || !last.gated) return <>{children}</>;
  const withinGrace = last.authenticated && Date.now() - last.at < OFFLINE_GRACE_MS;
  return withinGrace ? <>{children}</> : <GateScreen />;
}
