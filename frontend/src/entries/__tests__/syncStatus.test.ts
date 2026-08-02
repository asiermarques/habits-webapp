import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  recordDrainSuccess,
  recordDrainFailure,
  isSyncFailing,
  subscribeSyncStatus,
} from '../syncStatus';

describe('syncStatus', () => {
  beforeEach(() => {
    // Drain any streak left over from a previous test back to zero.
    recordDrainSuccess();
  });

  it('is not failing with no recorded failures', () => {
    expect(isSyncFailing()).toBe(false);
  });

  it('does not flip to failing on a single transient failure', () => {
    recordDrainFailure();
    expect(isSyncFailing()).toBe(false);
  });

  it('flips to failing once failures reach the threshold', () => {
    recordDrainFailure();
    recordDrainFailure();
    recordDrainFailure();
    expect(isSyncFailing()).toBe(true);
  });

  it('resets the streak on a success, so a later run of failures starts fresh', () => {
    recordDrainFailure();
    recordDrainFailure();
    recordDrainSuccess();
    recordDrainFailure();
    recordDrainFailure();
    expect(isSyncFailing()).toBe(false);
  });

  it('clears a failing state back to not-failing on success', () => {
    recordDrainFailure();
    recordDrainFailure();
    recordDrainFailure();
    expect(isSyncFailing()).toBe(true);

    recordDrainSuccess();
    expect(isSyncFailing()).toBe(false);
  });

  it('notifies subscribers when the streak changes', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSyncStatus(listener);

    recordDrainFailure();
    expect(listener).toHaveBeenCalledTimes(1);

    recordDrainSuccess();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    recordDrainFailure();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('does not notify subscribers on a redundant success while already at zero', () => {
    const listener = vi.fn();
    subscribeSyncStatus(listener);

    recordDrainSuccess();
    expect(listener).not.toHaveBeenCalled();
  });
});
