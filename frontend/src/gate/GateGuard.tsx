import type { ReactNode } from 'react';
import { GateScreen } from './GateScreen';
import { useGateStatus } from './queries';

// Wraps the app shell. While the gate status is unknown it renders nothing
// (a same-origin call that resolves quickly); once known it either shows the
// unlock screen (gated + locked) or the app. Mount this above the feature
// providers so their queries don't fire — and 401 — while the instance is locked.
export function GateGuard({ children }: { children: ReactNode }) {
  const { data, isLoading } = useGateStatus();

  if (isLoading || !data) return null;
  if (data.gated && !data.authenticated) return <GateScreen />;
  return <>{children}</>;
}
