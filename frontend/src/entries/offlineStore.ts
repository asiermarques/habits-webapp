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
export type PendingEntryRecord = {
  localId: number;
  userId: number;
  habitDefinitionId: number;
  type: HabitType;
  date: string;
  data: EntryData;
  createdAt: string;
};

type StoredState = {
  nextId: number;
  entries: PendingEntryRecord[];
};

function emptyState(): StoredState {
  return { nextId: -1, entries: [] };
}

function readState(): StoredState {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return emptyState();
  try {
    const parsed = JSON.parse(raw) as StoredState;
    if (!Array.isArray(parsed.entries) || typeof parsed.nextId !== 'number') {
      return emptyState();
    }
    return parsed;
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
  };
  writeState({ nextId: state.nextId - 1, entries: [...state.entries, record] });
  notify();
  return record;
}

export function removePendingEntry(localId: number): void {
  const state = readState();
  writeState({ ...state, entries: state.entries.filter((e) => e.localId !== localId) });
  notify();
}

// useSyncExternalStore requires getSnapshot to return a referentially stable
// value when nothing changed, or React re-renders forever comparing new
// array instances. `version` bumps on every store mutation; the filtered
// result is cached per userId until then.
let version = 0;
const filteredCache = new Map<number, { version: number; entries: PendingEntryRecord[] }>();
let allCache: { version: number; entries: PendingEntryRecord[] } | null = null;

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
