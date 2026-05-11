import { unlinkSync } from 'node:fs';
import { resolve } from 'node:path';

const backendDir = resolve(__dirname, '../backend');
const dbFiles = ['habits.e2e.db', 'habits.e2e.db-shm', 'habits.e2e.db-wal'];

export default async function globalSetup() {
  for (const file of dbFiles) {
    try {
      unlinkSync(resolve(backendDir, file));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }
}
