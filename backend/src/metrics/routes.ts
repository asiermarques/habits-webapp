import { Router } from 'express';
import { getWeeklyMetrics, isValidIsoDate } from './repository.js';

export const metricsRouter = Router();

metricsRouter.get('/weekly', (req, res) => {
  const userId = Number(req.query.userId);
  if (!Number.isInteger(userId)) {
    res.status(400).json({ error: 'userId is required' });
    return;
  }

  let habitDefinitionId: number | undefined;
  if (req.query.habitDefinitionId !== undefined) {
    const parsed = Number(req.query.habitDefinitionId);
    if (!Number.isInteger(parsed)) {
      res.status(400).json({ error: 'habitDefinitionId must be an integer' });
      return;
    }
    habitDefinitionId = parsed;
  }

  let today: string | undefined;
  if (req.query.today !== undefined) {
    if (typeof req.query.today !== 'string' || !isValidIsoDate(req.query.today)) {
      res.status(400).json({ error: 'today must be YYYY-MM-DD' });
      return;
    }
    today = req.query.today;
  }

  res.json(getWeeklyMetrics({ userId, habitDefinitionId, today }));
});
