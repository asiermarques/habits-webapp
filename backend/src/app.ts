import express from 'express';
import cors from 'cors';
import type { HealthResponse } from '@habitsapp/shared';
import { createUsersRouter } from './users/interface/routes.js';
import { DrizzleUserRepository } from './users/infrastructure/DrizzleUserRepository.js';
import { createHabitDefinitionsRouter } from './habit-definitions/interface/routes.js';
import { DrizzleHabitDefinitionRepository } from './habit-definitions/infrastructure/DrizzleHabitDefinitionRepository.js';
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

  const habitRepo = new DrizzleHabitDefinitionRepository();
  const userRepo = new DrizzleUserRepository({ seedFor: (id) => habitRepo.seedFor(id) });
  app.use('/users', createUsersRouter(userRepo));
  app.use('/habit-definitions', createHabitDefinitionsRouter(habitRepo));
  app.use('/entries', entriesRouter);
  app.use('/metrics', metricsRouter);
  app.use('/export', exportRouter);
  app.use('/settings', settingsRouter);

  app.use(domainErrorHandler);

  return app;
}
