// READ MODEL — no domain layer, no repository port, just read functions wired to HTTP.
import { Router } from 'express';
import { validateQuery } from '../../shared/http/validate.js';
import { exportQuerySchema } from './schemas.js';
import { getRowsInRange } from '../queries/getRowsInRange.js';
import { rowsToCsv } from '../csv.js';

export function createExportRouter(): Router {
  const router = Router();

  router.get('/csv', (req, res) => {
    const { userId, from, to } = validateQuery(req, exportQuerySchema);
    const rows = getRowsInRange({ userId, from, to });
    const csv = rowsToCsv(rows);

    const filename = `habits-${userId}-${from}-${to}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  });

  return router;
}
