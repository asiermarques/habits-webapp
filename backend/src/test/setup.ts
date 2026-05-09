import { beforeEach } from 'vitest';
import { db } from '../db/index.js';
import { users, habitDefinitions } from '../db/schema.js';
import { runMigrations } from '../db/migrate.js';

runMigrations();

beforeEach(() => {
  db.delete(habitDefinitions).run();
  db.delete(users).run();
});
