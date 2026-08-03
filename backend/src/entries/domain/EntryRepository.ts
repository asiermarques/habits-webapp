import type { Entry, EntriesPage, EntryCursor, EntryData } from '@habitsapp/shared';

export type ListFilters = {
  userId: number;
  habitDefinitionId?: number;
  cursor?: EntryCursor;
  limit?: number;
};

export type InsertInput = {
  habitDefinitionId: number;
  userId: number;
  date: string;
  data: EntryData;
  // Opaque, client-generated (002-entry-sync-protocol, GRISK-001). When set
  // and already recorded, the repository replays the original outcome
  // instead of re-applying the push.
  idempotencyKey?: string;
};

export type UpdateInput = {
  date?: string;
  data?: EntryData;
  idempotencyKey?: string;
};

export interface EntryRepository {
  list(filters: ListFilters): EntriesPage;
  findById(id: number): Entry | undefined;
  insert(input: InsertInput): Entry;
  update(id: number, patch: UpdateInput): Entry;
  delete(id: number, idempotencyKey?: string): void;
  hasEntriesForDefinition(id: number): boolean;
  // True when the definition already has any entry on the given date. Used by
  // backup import to skip duplicates (merge semantics).
  existsOnDate(habitDefinitionId: number, date: string): boolean;
}
