import { Router } from 'express';
import type { ImportResult } from '@habitsapp/shared';
import { validateBody, validateQuery } from '../../shared/middleware/validate.js';
import type { HabitDefinitionRepository } from '../../habit-definitions/domain/HabitDefinitionRepository.js';
import type { EntryRepository } from '../../entries/domain/EntryRepository.js';
import { buildBackup } from '../queries/buildBackup.js';
import { importBackup } from '../importBackup.js';
import { exportQuerySchema, importBodySchema } from './schemas.js';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// Backup spans the habit-definitions and entries slices, so it takes both
// repository ports and is wired in app.ts (cross-slice composition rule).
export function createBackupRouter(
  habitRepo: HabitDefinitionRepository,
  entryRepo: EntryRepository,
): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const { userId } = validateQuery(req, exportQuerySchema);
    const bundle = buildBackup(userId, todayIso());
    const filename = `habits-${userId}-backup-${bundle.exportedAt}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(bundle, null, 2));
  });

  router.post('/import', (req, res) => {
    const body = validateBody(req, importBodySchema);
    const result: ImportResult = importBackup(
      body.userId,
      { habitDefinitions: body.habitDefinitions, entries: body.entries },
      habitRepo,
      entryRepo,
    );
    res.json(result);
  });

  return router;
}
