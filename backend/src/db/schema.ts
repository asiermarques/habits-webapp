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
  amount: real('amount'),
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
  binary: integer('binary', { mode: 'boolean' }),
});
