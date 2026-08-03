import type { Entry, EntryData, HabitType } from '@habitsapp/shared';

// Durable, per-User local store of pending Entry changes (requisites FR-001,
// BR-001). localStorage rather than IndexedDB: writes are synchronous, so a
// failed write (BR-001) is reported at the call site instead of racing an
// async transaction, and it survives reload/process kill like the durability
// requirement calls for.
const STORAGE_KEY = 'habits.pendingEntries.v1';

export class OfflineStoreWriteError extends Error {
  constructor(cause: unknown) {
    super('Failed to write to the offline entry store');
    this.name = 'OfflineStoreWriteError';
    this.cause = cause;
  }
}

// Client-only identity (requisites "Risks / Implementation notes"): negative
// so it can never collide with a server-assigned id, and is never sent to the
// server. Kept stable across reloads via the persisted `nextId` counter.
// `idempotencyKey` is generated once, here, at queue time (002-entry-sync-
// protocol, GRISK-001) and persisted with the change so it survives a
// reload and is stable across every retry. Optional because a change queued
// by a pre-upgrade build won't have one on disk — it must keep draining
// keyless (at-least-once, exactly as before) rather than break. It
// identifies the *change*, never the Entry (BR-003): never derived from
// Entry Data, Cost Spent, or any name.
export type PendingEntryRecord = {
  localId: number;
  userId: number;
  habitDefinitionId: number;
  type: HabitType;
  date: string;
  data: EntryData;
  createdAt: string;
  idempotencyKey?: string;
};

// A queued change against an Entry that already has a server id (US-004/005).
// One slot per entryId: queuing a new op for the same entryId replaces
// whatever was queued before it, which *is* the collapse rule (US-006) —
// edit->edit nets to the latest update, edit->delete nets to the delete.
// A create that hasn't synced yet never gets an op; it's amended in place
// (amendPendingEntryCreate) instead, which is what keeps an update from ever
// being sent before the create it targets.
// The update variant's `habitDefinitionId`/`type` (US-004) let the drain
// re-create the Entry if its target has vanished by the time it's pushed —
// optional because a pre-upgrade build's stored op won't have them, and such
// an op can't be re-created (falls back to the Rejected change path instead
// of crashing the drain).
export type PendingEntryOp =
  | {
      kind: 'update';
      entryId: number;
      userId: number;
      date: string;
      data: EntryData;
      habitDefinitionId?: number;
      type?: HabitType;
      idempotencyKey?: string;
    }
  | {
      kind: 'delete';
      entryId: number;
      userId: number;
      habitDefinitionId: number;
      type: HabitType;
      date: string;
      data: EntryData;
      idempotencyKey?: string;
    };

type StoredState = {
  nextId: number;
  entries: PendingEntryRecord[];
  ops: PendingEntryOp[];
};

function emptyState(): StoredState {
  return { nextId: -1, entries: [], ops: [] };
}

function readState(): StoredState {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return emptyState();
  try {
    const parsed = JSON.parse(raw) as StoredState;
    if (!Array.isArray(parsed.entries) || typeof parsed.nextId !== 'number') {
      return emptyState();
    }
    return { ...parsed, ops: Array.isArray(parsed.ops) ? parsed.ops : [] };
  } catch {
    return emptyState();
  }
}

function writeState(state: StoredState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (cause) {
    throw new OfflineStoreWriteError(cause);
  }
}

const listeners = new Set<() => void>();

function notify(): void {
  version += 1;
  for (const listener of listeners) listener();
}

export function subscribePendingEntries(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPendingEntries(): PendingEntryRecord[] {
  return readState().entries;
}

export type AddPendingEntryCreateInput = {
  userId: number;
  habitDefinitionId: number;
  type: HabitType;
  date: string;
  data: EntryData;
};

export function addPendingEntryCreate(input: AddPendingEntryCreateInput): PendingEntryRecord {
  const state = readState();
  const record: PendingEntryRecord = {
    localId: state.nextId,
    userId: input.userId,
    habitDefinitionId: input.habitDefinitionId,
    type: input.type,
    date: input.date,
    data: input.data,
    createdAt: new Date().toISOString(),
    idempotencyKey: crypto.randomUUID(),
  };
  writeState({ ...state, nextId: state.nextId - 1, entries: [...state.entries, record] });
  notify();
  return record;
}

export function removePendingEntry(localId: number): void {
  const state = readState();
  writeState({ ...state, entries: state.entries.filter((e) => e.localId !== localId) });
  notify();
}

// Editing a create that hasn't synced yet has no server id to target with an
// update, so it amends the queued create's values in place (US-004/US-006).
export function amendPendingEntryCreate(
  localId: number,
  patch: { date: string; data: EntryData },
): void {
  const state = readState();
  writeState({
    ...state,
    entries: state.entries.map((e) =>
      e.localId === localId ? { ...e, date: patch.date, data: patch.data } : e,
    ),
  });
  notify();
}

export function getPendingOps(): PendingEntryOp[] {
  return readState().ops;
}

function upsertOp(op: PendingEntryOp): void {
  const state = readState();
  writeState({ ...state, ops: [...state.ops.filter((o) => o.entryId !== op.entryId), op] });
  notify();
}

export type AddPendingEntryUpdateInput = {
  entryId: number;
  userId: number;
  habitDefinitionId: number;
  type: HabitType;
  date: string;
  data: EntryData;
};

export function addPendingEntryUpdate(input: AddPendingEntryUpdateInput): void {
  upsertOp({ kind: 'update', ...input, idempotencyKey: crypto.randomUUID() });
}

export type AddPendingEntryDeleteInput = {
  entryId: number;
  userId: number;
  habitDefinitionId: number;
  type: HabitType;
  date: string;
  data: EntryData;
};

export function addPendingEntryDelete(input: AddPendingEntryDeleteInput): void {
  upsertOp({ kind: 'delete', ...input, idempotencyKey: crypto.randomUUID() });
}

export function removePendingOp(entryId: number): void {
  const state = readState();
  writeState({ ...state, ops: state.ops.filter((o) => o.entryId !== entryId) });
  notify();
}

// useSyncExternalStore requires getSnapshot to return a referentially stable
// value when nothing changed, or React re-renders forever comparing new
// array instances. `version` bumps on every store mutation; the filtered
// result is cached per userId until then.
let version = 0;
const filteredCache = new Map<number, { version: number; entries: PendingEntryRecord[] }>();
let allCache: { version: number; entries: PendingEntryRecord[] } | null = null;
const filteredOpsCache = new Map<number, { version: number; ops: PendingEntryOp[] }>();
let allOpsCache: { version: number; ops: PendingEntryOp[] } | null = null;

export function getPendingEntriesForUser(userId: number): PendingEntryRecord[] {
  const cached = filteredCache.get(userId);
  if (cached && cached.version === version) return cached.entries;
  const entries = getPendingEntries().filter((e) => e.userId === userId);
  filteredCache.set(userId, { version, entries });
  return entries;
}

// All pending entries across every User on this device — the header
// indicator is deliberately global (requisites: "single global indicator"),
// not scoped to whoever is the current Active User.
export function getAllPendingEntries(): PendingEntryRecord[] {
  if (allCache && allCache.version === version) return allCache.entries;
  const entries = getPendingEntries();
  allCache = { version, entries };
  return entries;
}

export function getPendingOpsForUser(userId: number): PendingEntryOp[] {
  const cached = filteredOpsCache.get(userId);
  if (cached && cached.version === version) return cached.ops;
  const ops = getPendingOps().filter((o) => o.userId === userId);
  filteredOpsCache.set(userId, { version, ops });
  return ops;
}

export function getAllPendingOps(): PendingEntryOp[] {
  if (allOpsCache && allOpsCache.version === version) return allOpsCache.ops;
  const ops = getPendingOps();
  allOpsCache = { version, ops };
  return ops;
}

// The one sanctioned exception to BR-005 ("no local change is dropped
// without either reaching the backend or being explicitly discarded by the
// user") — an explicit, user-confirmed escape hatch for a backlog that will
// never sync (US-009, OQ-003). All-or-nothing: clears every pending create
// and op across every User on this device in one shot. Returns how many
// items were discarded so the caller can confirm what just happened.
export function discardAllPending(): number {
  const state = readState();
  const count = state.entries.length + state.ops.length;
  writeState({ ...state, entries: [], ops: [] });
  notify();
  return count;
}

export function pendingEntryToEntry(record: PendingEntryRecord): Entry {
  return {
    id: record.localId,
    habitDefinitionId: record.habitDefinitionId,
    userId: record.userId,
    date: record.date,
    createdAt: record.createdAt,
    type: record.type,
    data: record.data,
  };
}
