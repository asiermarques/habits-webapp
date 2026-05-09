import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from './index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(__dirname, '../../drizzle');

export function runMigrations() {
  migrate(db, { migrationsFolder });
}
