import { describe, it, expect, beforeEach } from 'vitest';
import { rememberGated, wasGated } from '../storage';

describe('gate storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to not-gated when nothing has been remembered', () => {
    expect(wasGated()).toBe(false);
  });

  it('remembers that the instance is gated across reads', () => {
    rememberGated(true);
    expect(wasGated()).toBe(true);
  });

  it('clears the gated flag when the instance is no longer gated', () => {
    rememberGated(true);
    rememberGated(false);
    expect(wasGated()).toBe(false);
  });
});
