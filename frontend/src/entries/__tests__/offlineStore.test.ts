import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  addPendingEntryCreate,
  getPendingEntries,
  removePendingEntry,
  subscribePendingEntries,
  pendingEntryToEntry,
  OfflineStoreWriteError,
} from '../offlineStore';

beforeEach(() => {
  window.localStorage.clear();
});

describe('offlineStore', () => {
  it('starts empty', () => {
    expect(getPendingEntries()).toEqual([]);
  });

  it('records a pending create and returns it with a unique local id', () => {
    const record = addPendingEntryCreate({
      userId: 1,
      habitDefinitionId: 2,
      type: 'workout',
      date: '2026-08-01',
      data: { duration: 30 },
    });

    expect(record.localId).toBeTypeOf('number');
    expect(getPendingEntries()).toEqual([record]);
  });

  it('survives being read back from a fresh module-level load (simulated reload)', () => {
    addPendingEntryCreate({
      userId: 1,
      habitDefinitionId: 2,
      type: 'workout',
      date: '2026-08-01',
      data: { duration: 30 },
    });

    // Reload simulation: read straight from localStorage, as a fresh page load would.
    const raw = window.localStorage.getItem('habits.pendingEntries.v1');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).entries).toHaveLength(1);
  });

  it('assigns distinct local ids to successive pending entries', () => {
    const a = addPendingEntryCreate({
      userId: 1,
      habitDefinitionId: 2,
      type: 'workout',
      date: '2026-08-01',
      data: { duration: 30 },
    });
    const b = addPendingEntryCreate({
      userId: 1,
      habitDefinitionId: 2,
      type: 'workout',
      date: '2026-08-01',
      data: { duration: 45 },
    });
    expect(a.localId).not.toBe(b.localId);
  });

  it('removes a pending entry by local id', () => {
    const record = addPendingEntryCreate({
      userId: 1,
      habitDefinitionId: 2,
      type: 'workout',
      date: '2026-08-01',
      data: { duration: 30 },
    });
    removePendingEntry(record.localId);
    expect(getPendingEntries()).toEqual([]);
  });

  it('notifies subscribers when a pending entry is added or removed', () => {
    const listener = vi.fn();
    const unsubscribe = subscribePendingEntries(listener);

    const record = addPendingEntryCreate({
      userId: 1,
      habitDefinitionId: 2,
      type: 'workout',
      date: '2026-08-01',
      data: { duration: 30 },
    });
    expect(listener).toHaveBeenCalledTimes(1);

    removePendingEntry(record.localId);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    addPendingEntryCreate({
      userId: 1,
      habitDefinitionId: 2,
      type: 'workout',
      date: '2026-08-01',
      data: { duration: 30 },
    });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('surfaces a failure instead of silently dropping the entry when the write fails', () => {
    const setItem = vi
      .spyOn(window.localStorage.__proto__, 'setItem')
      .mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

    expect(() =>
      addPendingEntryCreate({
        userId: 1,
        habitDefinitionId: 2,
        type: 'workout',
        date: '2026-08-01',
        data: { duration: 30 },
      }),
    ).toThrow(OfflineStoreWriteError);
    expect(getPendingEntries()).toEqual([]);

    setItem.mockRestore();
  });

  it('converts a pending record into an Entry-shaped object for rendering', () => {
    const record = addPendingEntryCreate({
      userId: 1,
      habitDefinitionId: 2,
      type: 'workout',
      date: '2026-08-01',
      data: { duration: 30 },
    });
    const entry = pendingEntryToEntry(record);
    expect(entry).toMatchObject({
      id: record.localId,
      habitDefinitionId: 2,
      userId: 1,
      date: '2026-08-01',
      type: 'workout',
      data: { duration: 30 },
    });
    expect(entry.id).toBeLessThan(0);
  });
});
