import { beforeEach } from 'vitest';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { runMigrations } from '../db/migrate.js';

runMigrations();

beforeEach(() => {
  db.delete(users).run();
});
