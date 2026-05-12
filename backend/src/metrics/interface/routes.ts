// READ MODEL — no domain layer, no repository port, just read functions wired to HTTP.
import { Router } from 'express';
import { validateQuery } from '../../shared/http/validate.js';
import { baseQuerySchema, weeklyQuerySchema } from './schemas.js';
import { getWeeklyMetrics } from '../queries/weekly.js';
import { getByTypeMetrics } from '../queries/byType.js';
import { getByHabitMetrics } from '../queries/byHabit.js';
import { getHeatmapMetrics } from '../queries/heatmap.js';
import { getSummaryMetrics } from '../queries/summary.js';

export function createMetricsRouter(): Router {
  const router = Router();

  router.get('/weekly', (req, res) => {
    const { userId, habitDefinitionId, today } = validateQuery(req, weeklyQuerySchema);
    res.json(getWeeklyMetrics({ userId, habitDefinitionId, today }));
  });

  router.get('/by-type', (req, res) => {
    const { userId, today } = validateQuery(req, baseQuerySchema);
    res.json(getByTypeMetrics({ userId, today }));
  });

  router.get('/by-habit', (req, res) => {
    const { userId, today } = validateQuery(req, baseQuerySchema);
    res.json(getByHabitMetrics({ userId, today }));
  });

  router.get('/summary', (req, res) => {
    const { userId, today } = validateQuery(req, baseQuerySchema);
    res.json(getSummaryMetrics({ userId, today }));
  });

  router.get('/heatmap', (req, res) => {
    const { userId, today } = validateQuery(req, baseQuerySchema);
    res.json(getHeatmapMetrics({ userId, today }));
  });

  return router;
}
