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

export const HABIT_CURATED_COLORS = [
  '#f43f5e', '#f97316', '#f59e0b', '#eab308',
  '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  '#94a3b8', '#64748b', '#475569', '#1e293b', '#0f172a',
] as const;

export const HABIT_NEGATIVE_COLOR = '#ef4444';

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
  color?: string;
};

export type UpdateHabitDefinitionBody = {
  name?: string;
  type?: HabitType;
  positive?: boolean;
  color?: string;
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
  // Opaque, client-generated (002-entry-sync-protocol, GRISK-001). Identifies
  // the *change*, never the Entry — never derived from Entry Data.
  idempotencyKey?: string;
};

export type UpdateEntryBody = {
  date?: string;
  data?: EntryData;
  idempotencyKey?: string;
};

export type DeleteEntryBody = {
  idempotencyKey?: string;
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

// ---------------------------------------------------------------------------
// Auth — instance password gate
//
// A deployment-level barrier, NOT per-User authentication. One shared password
// (env-configured) unlocks the whole instance; when unconfigured the gate is
// disabled (fail-open). See docs/PRODUCT.md "Product decisions worth knowing".

// Returned by GET /api/auth/status so the client knows whether to show the
// unlock screen. `authenticated` is always true when `gated` is false.
export type GateStatus = {
  gated: boolean;
  authenticated: boolean;
};

// Returned by POST /api/auth/login.
export type GateLoginResponse = {
  authenticated: boolean;
};

// --- Backup (import/export of a single user's definitions + entries) ---

export const BACKUP_VERSION = 1;

// A habit definition as it appears in a backup bundle. Identified by `name`
// (ids are instance-local and not portable across instances).
export type BackupHabitDefinition = {
  name: string;
  type: HabitType;
  positive: boolean;
  color: string;
};

// An entry in a backup bundle, linked to its definition by `habitName`.
export type BackupEntry = {
  habitName: string;
  date: string; // YYYY-MM-DD
  data: EntryData;
};

// The full export/import payload for one user.
export type BackupBundle = {
  version: number;
  exportedAt: string; // YYYY-MM-DD, informational
  habitDefinitions: BackupHabitDefinition[];
  entries: BackupEntry[];
};

// Summary returned by POST /api/backup/import (merge-skip semantics).
export type ImportResult = {
  habitsCreated: number;
  habitsSkipped: number;
  entriesCreated: number;
  entriesSkipped: number;
};

// Response of GET /api/sync/version — an opaque change token for one User's
// view of the instance (their data plus the instance-wide bits). Clients hold
// the last value they saw and compare for equality to decide whether anything
// needs refetching; the format is not part of the contract, so never parse it.
export type DataVersionResponse = {
  version: string;
};
