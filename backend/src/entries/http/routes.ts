import { Router } from 'express';
import type { EntryCursor } from '@habitsapp/shared';
import { validateBody, validateQuery } from '../../shared/middleware/validate.js';
import { listQuerySchema, createEntrySchema, updateEntrySchema } from './schemas.js';
import type { EntryRepository } from '../domain/EntryRepository.js';

function encodeCursor(cursor: EntryCursor | null): string | null {
  if (!cursor) return null;
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

export function createEntriesRouter(entryRepo: EntryRepository): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const { userId, habitDefinitionId, cursor, limit } = validateQuery(req, listQuerySchema);
    const page = entryRepo.list({ userId, habitDefinitionId, cursor, limit });
    res.json({ items: page.items, nextCursor: encodeCursor(page.nextCursor) });
  });

  router.post('/', (req, res) => {
    const input = validateBody(req, createEntrySchema);
    const entry = entryRepo.insert(input);
    res.status(201).json(entry);
  });

  router.put('/:id', (req, res) => {
    const id = Number(req.params.id);
    const patch = validateBody(req, updateEntrySchema);
    res.json(entryRepo.update(id, patch));
  });

  router.delete('/:id', (req, res) => {
    const id = Number(req.params.id);
    entryRepo.delete(id);
    res.status(204).end();
  });

  return router;
}
