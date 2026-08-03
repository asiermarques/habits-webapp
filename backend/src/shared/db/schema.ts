import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text, real } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

export type DbUser = typeof users.$inferSelect;
export type DbInsertUser = typeof users.$inferInsert;

export const habitDefinitions = sqliteTable('habit_definitions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type', { enum: ['workout', 'writing', 'custom'] }).notNull(),
  positive: integer('positive', { mode: 'boolean' }).notNull().default(true),
  color: text('color').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

export type DbHabitDefinition = typeof habitDefinitions.$inferSelect;
export type DbInsertHabitDefinition = typeof habitDefinitions.$inferInsert;

export const entries = sqliteTable('entries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  habitDefinitionId: integer('habit_definition_id')
    .notNull()
    .references(() => habitDefinitions.id, { onDelete: 'restrict' }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  date: text('date').notNull(), // ISO YYYY-MM-DD
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

export type DbEntry = typeof entries.$inferSelect;
export type DbInsertEntry = typeof entries.$inferInsert;

export const entryWorkoutData = sqliteTable('entry_workout_data', {
  entryId: integer('entry_id')
    .primaryKey()
    .references(() => entries.id, { onDelete: 'cascade' }),
  duration: integer('duration').notNull(), // minutes
  distance: real('distance'), // km
  weight: real('weight'), // kg
  number: real('number'), // repetitions
  notes: text('notes'),
});

export const entryWritingData = sqliteTable('entry_writing_data', {
  entryId: integer('entry_id')
    .primaryKey()
    .references(() => entries.id, { onDelete: 'cascade' }),
  words: integer('words').notNull(),
  time: integer('time'), // minutes
});

export const entryCustomData = sqliteTable('entry_custom_data', {
  entryId: integer('entry_id')
    .primaryKey()
    .references(() => entries.id, { onDelete: 'cascade' }),
  number: real('number'),
  amount: real('amount'),
  duration: integer('duration'), // minutes
});

// Singleton key/value store for app-wide settings (shared across all users).
// Currently used for the bad-habit cost currency code.
export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

// Dedupe store for the Entry sync protocol (002-entry-sync-protocol,
// GRISK-001): one row per applied Idempotency Key, so a retried push replays
// the recorded outcome instead of re-applying. `entryId` is a plain column,
// not an FK — the record must outlive the Entry it describes (a delete
// mustn't cascade-erase the very key that dedupes its own retry), and it is
// opaque bookkeeping, not a relational reference. `responseBody` is the
// JSON-serialized Entry for create/update replay; null for a delete (whose
// only recorded outcome is "already gone, done").
export const appliedIdempotencyKeys = sqliteTable('applied_idempotency_keys', {
  key: text('key').primaryKey(),
  entryId: integer('entry_id'),
  responseBody: text('response_body'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

export type DbAppliedIdempotencyKey = typeof appliedIdempotencyKeys.$inferSelect;

// Monotonic change counters, one row per scope ('global', 'user:<id>'), bumped
// inside the same transaction as every write another device could need to see.
// `GET /api/sync/version` reads them so a client can ask "has anything changed?"
// in one tiny request instead of periodically refetching entries and metrics.
//
// A counter rather than a timestamp: it moves for updates and deletes too,
// which a max(created_at) over the data tables would miss entirely (an edited
// Entry keeps its created_at; a deleted one leaves nothing behind). It is
// bookkeeping, not data — nothing references it, and it is never exported,
// backed up, or shown to the user.
export const dataVersions = sqliteTable('data_versions', {
  scope: text('scope').primaryKey(),
  version: integer('version').notNull().default(0),
});

export type DbDataVersion = typeof dataVersions.$inferSelect;
