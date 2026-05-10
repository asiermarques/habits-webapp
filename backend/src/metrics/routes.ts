import { Router, type Request } from 'express';
import {
  getByTypeMetrics,
  getHeatmapMetrics,
  getWeeklyMetrics,
  isValidIsoDate,
} from './repository.js';

export const metricsRouter = Router();

function parseUserId(req: Request): number | { error: string } {
  const userId = Number(req.query.userId);
  if (!Number.isInteger(userId)) return { error: 'userId is required' };
  return userId;
}

function parseToday(req: Request): string | undefined | { error: string } {
  if (req.query.today === undefined) return undefined;
  if (typeof req.query.today !== 'string' || !isValidIsoDate(req.query.today)) {
    return { error: 'today must be YYYY-MM-DD' };
  }
  return req.query.today;
}

metricsRouter.get('/weekly', (req, res) => {
  const userId = parseUserId(req);
  if (typeof userId === 'object') {
    res.status(400).json(userId);
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

  const today = parseToday(req);
  if (typeof today === 'object' && today !== undefined) {
    res.status(400).json(today);
    return;
  }

  res.json(getWeeklyMetrics({ userId, habitDefinitionId, today }));
});

metricsRouter.get('/by-type', (req, res) => {
  const userId = parseUserId(req);
  if (typeof userId === 'object') {
    res.status(400).json(userId);
    return;
  }

  const today = parseToday(req);
  if (typeof today === 'object' && today !== undefined) {
    res.status(400).json(today);
    return;
  }

  res.json(getByTypeMetrics({ userId, today }));
});

metricsRouter.get('/heatmap', (req, res) => {
  const userId = parseUserId(req);
  if (typeof userId === 'object') {
    res.status(400).json(userId);
    return;
  }

  const today = parseToday(req);
  if (typeof today === 'object' && today !== undefined) {
    res.status(400).json(today);
    return;
  }

  res.json(getHeatmapMetrics({ userId, today }));
});
