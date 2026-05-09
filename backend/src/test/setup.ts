import { beforeEach } from 'vitest';
import { db } from '../db/index.js';
import {
  users,
  habitDefinitions,
  entries,
  entryWorkoutData,
  entryWritingData,
  entryCustomData,
} from '../db/schema.js';
import { runMigrations } from '../db/migrate.js';

runMigrations();

beforeEach(() => {
  // Order matters: child rows first, then parents.
  db.delete(entryWorkoutData).run();
  db.delete(entryWritingData).run();
  db.delete(entryCustomData).run();
  db.delete(entries).run();
  db.delete(habitDefinitions).run();
  db.delete(users).run();
});
