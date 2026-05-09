// Shared types between backend and frontend.
// Will grow with each slice.

export type HealthResponse = {
  ok: boolean;
};

export type User = {
  id: number;
  name: string;
  isDefault: boolean;
  createdAt: string;
};

export type CreateUserBody = {
  name: string;
};

export type UpdateUserBody = {
  name?: string;
  isDefault?: boolean;
};

export type HabitType = 'workout' | 'writing' | 'custom';

export const HABIT_TYPES: HabitType[] = ['workout', 'writing', 'custom'];

export type HabitDefinition = {
  id: number;
  name: string;
  type: HabitType;
  positive: boolean;
  color: string;
  createdAt: string;
  hasEntries: boolean;
};

export type CreateHabitDefinitionBody = {
  name: string;
  type: HabitType;
  positive?: boolean;
};

export type UpdateHabitDefinitionBody = {
  name?: string;
  type?: HabitType;
  positive?: boolean;
};

// --- Entries ---

// Type-specific payloads. Units: duration/time in minutes, distance in km,
// weight in kg. All optional fields may be null when absent.
export type WorkoutData = {
  duration: number;
  distance?: number | null;
  weight?: number | null;
  amount?: number | null;
  notes?: string | null;
};

export type WritingData = {
  words: number;
  time?: number | null;
};

export type CustomData = {
  number?: number | null;
  amount?: number | null;
  duration?: number | null;
  binary?: boolean | null;
};

export type EntryData = WorkoutData | WritingData | CustomData;

export type Entry = {
  id: number;
  habitDefinitionId: number;
  userId: number;
  date: string; // YYYY-MM-DD
  createdAt: string;
  type: HabitType; // denormalized from the linked definition for convenience
  data: EntryData;
};

export type EntryCursor = {
  date: string;
  id: number;
};

export type EntriesPage = {
  items: Entry[];
  nextCursor: EntryCursor | null;
};

export type CreateEntryBody = {
  habitDefinitionId: number;
  userId: number;
  date: string;
  data: EntryData;
};

export type UpdateEntryBody = {
  date?: string;
  data?: EntryData;
};
