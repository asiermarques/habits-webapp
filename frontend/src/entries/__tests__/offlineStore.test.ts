import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  addPendingEntryCreate,
  addPendingEntryUpdate,
  addPendingEntryDelete,
  amendPendingEntryCreate,
  getPendingEntries,
  getPendingOps,
  getAllPendingOps,
  getPendingOpsForUser,
  removePendingEntry,
  removePendingOp,
  subscribePendingEntries,
  pendingEntryToEntry,
  discardAllPending,
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

describe('amendPendingEntryCreate', () => {
  it('mutates a still-pending create in place instead of queuing a separate update', () => {
    const record = addPendingEntryCreate({
      userId: 1,
      habitDefinitionId: 2,
      type: 'workout',
      date: '2026-08-01',
      data: { duration: 30 },
    });

    amendPendingEntryCreate(record.localId, { date: '2026-08-02', data: { duration: 45 } });

    const entries = getPendingEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      localId: record.localId,
      date: '2026-08-02',
      data: { duration: 45 },
    });
  });

  it('keeps only the latest values after amending the same create twice (collapse)', () => {
    const record = addPendingEntryCreate({
      userId: 1,
      habitDefinitionId: 2,
      type: 'workout',
      date: '2026-08-01',
      data: { duration: 30 },
    });

    amendPendingEntryCreate(record.localId, { date: '2026-08-02', data: { duration: 45 } });
    amendPendingEntryCreate(record.localId, { date: '2026-08-03', data: { duration: 60 } });

    const entries = getPendingEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ date: '2026-08-03', data: { duration: 60 } });
  });

  it('notifies subscribers on amend', () => {
    const record = addPendingEntryCreate({
      userId: 1,
      habitDefinitionId: 2,
      type: 'workout',
      date: '2026-08-01',
      data: { duration: 30 },
    });
    const listener = vi.fn();
    subscribePendingEntries(listener);

    amendPendingEntryCreate(record.localId, { date: '2026-08-02', data: { duration: 45 } });

    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('pending ops (updates and deletes against synced Entries)', () => {
  it('queues an update against a synced Entry id', () => {
    addPendingEntryUpdate({ entryId: 10, userId: 1, date: '2026-08-02', data: { duration: 45 } });

    const ops = getPendingOps();
    expect(ops).toEqual([
      { kind: 'update', entryId: 10, userId: 1, date: '2026-08-02', data: { duration: 45 } },
    ]);
  });

  it('queues a delete against a synced Entry id, carrying enough of a snapshot to subtract it from metrics', () => {
    addPendingEntryDelete({
      entryId: 10,
      userId: 1,
      habitDefinitionId: 2,
      type: 'workout',
      date: '2026-08-02',
      data: { duration: 45 },
    });

    const ops = getPendingOps();
    expect(ops).toEqual([
      {
        kind: 'delete',
        entryId: 10,
        userId: 1,
        habitDefinitionId: 2,
        type: 'workout',
        date: '2026-08-02',
        data: { duration: 45 },
      },
    ]);
  });

  it('collapses a second update on the same Entry into a single net update (edit->edit)', () => {
    addPendingEntryUpdate({ entryId: 10, userId: 1, date: '2026-08-02', data: { duration: 45 } });
    addPendingEntryUpdate({ entryId: 10, userId: 1, date: '2026-08-03', data: { duration: 60 } });

    const ops = getPendingOps();
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ kind: 'update', date: '2026-08-03', data: { duration: 60 } });
  });

  it('collapses an update followed by a delete into just the delete (edit->delete)', () => {
    addPendingEntryUpdate({ entryId: 10, userId: 1, date: '2026-08-02', data: { duration: 45 } });
    addPendingEntryDelete({
      entryId: 10,
      userId: 1,
      habitDefinitionId: 2,
      type: 'workout',
      date: '2026-08-01',
      data: { duration: 30 },
    });

    const ops = getPendingOps();
    expect(ops).toHaveLength(1);
    expect(ops[0].kind).toBe('delete');
  });

  it('does not let an op on one Entry affect the op queued for another', () => {
    addPendingEntryUpdate({ entryId: 10, userId: 1, date: '2026-08-02', data: { duration: 45 } });
    addPendingEntryUpdate({ entryId: 11, userId: 1, date: '2026-08-03', data: { duration: 60 } });

    expect(getPendingOps()).toHaveLength(2);
  });

  it('removes a pending op by entry id', () => {
    addPendingEntryUpdate({ entryId: 10, userId: 1, date: '2026-08-02', data: { duration: 45 } });
    removePendingOp(10);

    expect(getPendingOps()).toEqual([]);
  });

  it('survives a simulated reload', () => {
    addPendingEntryUpdate({ entryId: 10, userId: 1, date: '2026-08-02', data: { duration: 45 } });

    const raw = window.localStorage.getItem('habits.pendingEntries.v1');
    const parsed = JSON.parse(raw!);
    expect(parsed.ops).toHaveLength(1);
  });

  it('filters ops by user', () => {
    addPendingEntryUpdate({ entryId: 10, userId: 1, date: '2026-08-02', data: { duration: 45 } });
    addPendingEntryUpdate({ entryId: 20, userId: 2, date: '2026-08-02', data: { duration: 45 } });

    expect(getPendingOpsForUser(1)).toHaveLength(1);
    expect(getAllPendingOps()).toHaveLength(2);
  });

  it('notifies subscribers when an op is added or removed', () => {
    const listener = vi.fn();
    subscribePendingEntries(listener);

    addPendingEntryUpdate({ entryId: 10, userId: 1, date: '2026-08-02', data: { duration: 45 } });
    expect(listener).toHaveBeenCalledTimes(1);

    removePendingOp(10);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('discardAllPending (US-009)', () => {
  it('clears every pending create and op in one shot', () => {
    addPendingEntryCreate({ userId: 1, habitDefinitionId: 2, type: 'workout', date: '2026-08-01', data: { duration: 30 } });
    addPendingEntryUpdate({ entryId: 10, userId: 1, date: '2026-08-02', data: { duration: 45 } });

    discardAllPending();

    expect(getPendingEntries()).toEqual([]);
    expect(getPendingOps()).toEqual([]);
  });

  it('returns how many items were discarded', () => {
    addPendingEntryCreate({ userId: 1, habitDefinitionId: 2, type: 'workout', date: '2026-08-01', data: { duration: 30 } });
    addPendingEntryUpdate({ entryId: 10, userId: 1, date: '2026-08-02', data: { duration: 45 } });

    expect(discardAllPending()).toBe(2);
  });

  it('notifies subscribers once', () => {
    addPendingEntryCreate({ userId: 1, habitDefinitionId: 2, type: 'workout', date: '2026-08-01', data: { duration: 30 } });
    const listener = vi.fn();
    subscribePendingEntries(listener);

    discardAllPending();

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
