// The gate module's own slice of persistence: a snapshot of the last gate
// status this browser confirmed online — whether the instance is gated, whether
// we were authenticated, and when. GateGuard reads it to decide what to show
// when the status call can't reach the server (typically offline): a gated
// instance opens offline only within a grace window of the last online unlock,
// otherwise it fails closed so cached data isn't shown without a fresh unlock.
// See [[GateGuard]].
const GATE_KEY = 'habits.gate.snapshot';

export type GateSnapshot = {
  gated: boolean;
  authenticated: boolean;
  // Epoch ms when this status was last confirmed online. Used by GateGuard to
  // bound how long a gated instance stays readable offline.
  at: number;
};

export function rememberGate(status: { gated: boolean; authenticated: boolean }): void {
  try {
    const snapshot: GateSnapshot = { ...status, at: Date.now() };
    localStorage.setItem(GATE_KEY, JSON.stringify(snapshot));
  } catch {
    // Storage can be unavailable (private mode, quota). Failing to remember is
    // safe: GateGuard treats a missing snapshot as not-gated, matching a fresh
    // install.
  }
}

export function lastKnownGate(): GateSnapshot | null {
  try {
    const raw = localStorage.getItem(GATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GateSnapshot>;
    if (
      typeof parsed.gated !== 'boolean' ||
      typeof parsed.authenticated !== 'boolean' ||
      typeof parsed.at !== 'number'
    ) {
      return null;
    }
    return { gated: parsed.gated, authenticated: parsed.authenticated, at: parsed.at };
  } catch {
    return null;
  }
}
