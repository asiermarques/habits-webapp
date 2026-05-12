import express from 'express';
import cors from 'cors';
import type { HealthResponse } from '@habitsapp/shared';
import { createUsersRouter } from './users/interface/routes.js';
import { DrizzleUserRepository } from './users/infrastructure/DrizzleUserRepository.js';
import { seedHabitDefinitionsForUser } from './habit-definitions/seed.js';
import { habitDefinitionsRouter } from './habit-definitions/routes.js';
import { entriesRouter } from './entries/routes.js';
import { metricsRouter } from './metrics/routes.js';
import { exportRouter } from './export/routes.js';
import { settingsRouter } from './settings/routes.js';
import { domainErrorHandler } from './shared/http/errorHandler.js';

export function createApp() {
  const app = express();
  const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:5173';

  app.use(cors({ origin: corsOrigin }));
  app.use(express.json());

  app.get('/health', (_req, res) => {
    const body: HealthResponse = { ok: true };
    res.json(body);
  });

  const userRepo = new DrizzleUserRepository({ seedFor: seedHabitDefinitionsForUser });
  app.use('/users', createUsersRouter(userRepo));
  app.use('/habit-definitions', habitDefinitionsRouter);
  app.use('/entries', entriesRouter);
  app.use('/metrics', metricsRouter);
  app.use('/export', exportRouter);
  app.use('/settings', settingsRouter);

  app.use(domainErrorHandler);

  return app;
}
