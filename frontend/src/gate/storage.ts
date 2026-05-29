// The gate module's own slice of persistence: whether this instance was last
// known to be gated. GateGuard reads it to fail closed when the gate status
// can't be fetched (typically offline) so service-worker-cached data is never
// shown for a gated instance without a fresh unlock. See [[GateGuard]].
const GATED_KEY = 'habits.gate.gated';

export function rememberGated(gated: boolean): void {
  try {
    localStorage.setItem(GATED_KEY, gated ? '1' : '0');
  } catch {
    // Storage can be unavailable (private mode, quota). Failing to remember is
    // safe: GateGuard treats "unknown" as not-gated, matching a fresh install.
  }
}

export function wasGated(): boolean {
  try {
    return localStorage.getItem(GATED_KEY) === '1';
  } catch {
    return false;
  }
}
