import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

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
