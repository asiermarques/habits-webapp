// Shared types between backend and frontend.
// Will grow with each slice.

export type HealthResponse = {
  ok: boolean;
};

// Global app settings shared across all users.
export const SUPPORTED_CURRENCIES = ['EUR', 'USD', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD'] as const;
export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

export const SUPPORTED_LOCALES = ['en', 'es'] as const;
export type LocaleCode = (typeof SUPPORTED_LOCALES)[number];

export type AppSettings = {
  currency: CurrencyCode;
  locale: LocaleCode;
};

export type UpdateCurrencyBody = {
  currency: CurrencyCode;
};

export type UpdateLocaleBody = {
  locale: LocaleCode;
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
  userId: number;
  name: string;
  type: HabitType;
  positive: boolean;
  color: string;
  createdAt: string;
  hasEntries: boolean;
};

export type CreateHabitDefinitionBody = {
  userId: number;
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
  number?: number | null;
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

// --- Metrics ---

export type HabitCount = {
  habitDefinitionId: number;
  count: number;
};

export type WeekDayMetrics = {
  date: string; // YYYY-MM-DD
  // Sparse: only habits with at least one entry on this date appear here.
  counts: HabitCount[];
};

export type WeeklyMetrics = {
  weekStart: string; // Monday, YYYY-MM-DD
  weekEnd: string;   // Sunday, YYYY-MM-DD
  // Always 7 entries, Mon..Sun.
  days: WeekDayMetrics[];
};

// --- Last 3 months metrics (Slice 5) ---
//
// Range is 13 complete Mon..Sun weeks ending with the week that contains the
// anchor day (today by default). That gives ~91 days, the closest week-aligned
// approximation of "last 3 months".

export type ByTypeWeek = {
  weekStart: string; // Monday, YYYY-MM-DD
  weekEnd: string;   // Sunday, YYYY-MM-DD
  workout: number;
  writing: number;
  custom: number;
};

export type ByTypeMetrics = {
  rangeStart: string; // Monday of the earliest week
  rangeEnd: string;   // Sunday of the latest week
  weeks: ByTypeWeek[]; // length 13, oldest first
};

export type ByHabitWeek = {
  weekStart: string; // Monday, YYYY-MM-DD
  weekEnd: string;   // Sunday, YYYY-MM-DD
  habits: HabitCount[]; // sparse: only habits with entries appear
};

export type ByHabitMetrics = {
  rangeStart: string; // Monday of the earliest week
  rangeEnd: string;   // Sunday of the latest week
  weeks: ByHabitWeek[]; // length 13, oldest first
};

export type HeatmapDay = {
  date: string; // YYYY-MM-DD
  count: number;
};

export type HabitHeatmap = {
  habitDefinitionId: number;
  // Sparse: only days with at least one entry are listed.
  days: HeatmapDay[];
};

export type HeatmapMetrics = {
  rangeStart: string; // Monday of the earliest week
  rangeEnd: string;   // Sunday of the latest week
  habits: HabitHeatmap[];
};

// Last 30 days summary — drives the four score cards on the Metrics page.
//
// `mostRegistered`: highest non-zero repetition count in the window, or null
//                   if there are no entries.
// `leastRegistered`: lowest count across *all* the user's habit definitions —
//                    habits with zero entries can win this card (count: 0).
//                    Null only if the user has no habits at all.
// `badHabitsTotalCost`: sum of the `amount` (cost) field across custom entries
//                       belonging to negative ("bad") habits. Only custom
//                       habits can be negative and `amount` is custom-only.
// `activeHabitsCount`: number of distinct habits with at least one entry.
export type SummaryMetrics = {
  rangeStart: string; // inclusive, YYYY-MM-DD
  rangeEnd: string;   // inclusive (anchor day)
  mostRegistered: HabitCount | null;
  leastRegistered: HabitCount | null;
  badHabitsTotalCost: number;
  activeHabitsCount: number;
};
