import { Router } from 'express';
import { getExportRows, rowsToCsv } from './repository.js';
import { isValidIsoDate } from '../metrics/repository.js';

export const exportRouter = Router();

exportRouter.get('/csv', (req, res) => {
  const userId = Number(req.query.userId);
  if (!Number.isInteger(userId)) {
    res.status(400).json({ error: 'userId is required' });
    return;
  }

  const from = req.query.from;
  const to = req.query.to;
  if (typeof from !== 'string' || !isValidIsoDate(from)) {
    res.status(400).json({ error: 'from must be YYYY-MM-DD' });
    return;
  }
  if (typeof to !== 'string' || !isValidIsoDate(to)) {
    res.status(400).json({ error: 'to must be YYYY-MM-DD' });
    return;
  }
  if (from > to) {
    res.status(400).json({ error: 'from must be on or before to' });
    return;
  }

  const rows = getExportRows({ userId, from, to });
  const csv = rowsToCsv(rows);

  const filename = `habits-${userId}-${from}-${to}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
});
