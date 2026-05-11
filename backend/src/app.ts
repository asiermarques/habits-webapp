import express from 'express';
import cors from 'cors';
import type { HealthResponse } from '@habitsapp/shared';
import { usersRouter } from './users/routes.js';
import { habitDefinitionsRouter } from './habit-definitions/routes.js';
import { entriesRouter } from './entries/routes.js';
import { metricsRouter } from './metrics/routes.js';
import { exportRouter } from './export/routes.js';

export function createApp() {
  const app = express();
  const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:5173';

  app.use(cors({ origin: corsOrigin }));
  app.use(express.json());

  app.get('/health', (_req, res) => {
    const body: HealthResponse = { ok: true };
    res.json(body);
  });

  app.use('/users', usersRouter);
  app.use('/habit-definitions', habitDefinitionsRouter);
  app.use('/entries', entriesRouter);
  app.use('/metrics', metricsRouter);
  app.use('/export', exportRouter);

  return app;
}
