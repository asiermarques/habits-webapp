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
};

export type UpdateInput = {
  date?: string;
  data?: EntryData;
};

export interface EntryRepository {
  list(filters: ListFilters): EntriesPage;
  findById(id: number): Entry | undefined;
  insert(input: InsertInput): Entry;
  update(id: number, patch: UpdateInput): Entry;
  delete(id: number): void;
  hasEntriesForDefinition(id: number): boolean;
}
