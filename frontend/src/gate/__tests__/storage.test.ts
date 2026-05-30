import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { rememberGate, lastKnownGate } from '../storage';

describe('gate storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when nothing has been remembered', () => {
    expect(lastKnownGate()).toBeNull();
  });

  it('remembers the gated and authenticated flags across reads', () => {
    rememberGate({ gated: true, authenticated: true });
    expect(lastKnownGate()).toMatchObject({ gated: true, authenticated: true });
  });

  it('stamps the snapshot with the time it was confirmed online', () => {
    const now = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    rememberGate({ gated: true, authenticated: true });
    expect(lastKnownGate()?.at).toBe(now);
  });

  it('overwrites the previous snapshot on each confirmation', () => {
    rememberGate({ gated: true, authenticated: true });
    rememberGate({ gated: true, authenticated: false });
    expect(lastKnownGate()).toMatchObject({ gated: true, authenticated: false });
  });

  it('returns null when the stored snapshot is malformed', () => {
    localStorage.setItem('habits.gate.snapshot', 'not json');
    expect(lastKnownGate()).toBeNull();
  });
});
