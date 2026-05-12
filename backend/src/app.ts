import express from 'express';
import cors from 'cors';
import type { HealthResponse } from '@habitsapp/shared';
import { createUsersRouter } from './users/interface/routes.js';
import { DrizzleUserRepository } from './users/infrastructure/DrizzleUserRepository.js';
import { createHabitDefinitionsRouter } from './habit-definitions/interface/routes.js';
import { DrizzleHabitDefinitionRepository } from './habit-definitions/infrastructure/DrizzleHabitDefinitionRepository.js';
import { createEntriesRouter } from './entries/interface/routes.js';
import { DrizzleEntryRepository } from './entries/infrastructure/DrizzleEntryRepository.js';
import { createMetricsRouter } from './metrics/interface/routes.js';
import { createExportRouter } from './export/interface/routes.js';
import { createSettingsRouter } from './settings/interface/routes.js';
import { DrizzleSettingsRepository } from './settings/infrastructure/DrizzleSettingsRepository.js';
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

  const entryRepo = new DrizzleEntryRepository();
  const habitRepo = new DrizzleHabitDefinitionRepository(entryRepo);
  const userRepo = new DrizzleUserRepository({ seedFor: (id) => habitRepo.seedFor(id) });
  app.use('/users', createUsersRouter(userRepo));
  app.use('/habit-definitions', createHabitDefinitionsRouter(habitRepo));
  app.use('/entries', createEntriesRouter(entryRepo));
  app.use('/metrics', createMetricsRouter());
  app.use('/export', createExportRouter());
  app.use('/settings', createSettingsRouter(new DrizzleSettingsRepository()));

  app.use(domainErrorHandler);

  return app;
}
