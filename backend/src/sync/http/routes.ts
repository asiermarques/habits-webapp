// READ MODEL — no domain layer, no repository port. Reads the change counters
// the repository adapters bump (shared/db/dataVersion.ts).
import { Router } from 'express';
import type { DataVersionResponse } from '@habitsapp/shared';
import { validateQuery } from '../../shared/middleware/validate.js';
import { readDataVersion } from '../../shared/db/dataVersion.js';
import { versionQuerySchema } from './schemas.js';

// GET /api/sync/version?userId=N — "has anything changed since the token I
// hold?", answered in one small response instead of periodically refetching
// entries and metrics on every client. Deliberately does no work proportional
// to the data: two indexed primary-key lookups, no scan of entries.
//
// The token is opaque to clients: compare for equality, never parse.
export function createSyncRouter(): Router {
  const router = Router();

  router.get('/version', (req, res) => {
    const { userId } = validateQuery(req, versionQuerySchema);
    const body: DataVersionResponse = { version: readDataVersion(userId) };
    res.json(body);
  });

  return router;
}
