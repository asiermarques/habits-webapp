import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { HealthResponse } from '@habitsapp/shared';
import { createUsersRouter } from './users/http/routes.js';
import { DrizzleUserRepository } from './users/infrastructure/DrizzleUserRepository.js';
import { createHabitDefinitionsRouter } from './habit-definitions/http/routes.js';
import { DrizzleHabitDefinitionRepository } from './habit-definitions/infrastructure/DrizzleHabitDefinitionRepository.js';
import { createEntriesRouter } from './entries/http/routes.js';
import { DrizzleEntryRepository } from './entries/infrastructure/DrizzleEntryRepository.js';
import { createMetricsRouter } from './metrics/http/routes.js';
import { createExportRouter } from './export/http/routes.js';
import { createSettingsRouter } from './settings/http/routes.js';
import { DrizzleSettingsRepository } from './settings/infrastructure/DrizzleSettingsRepository.js';
import { domainErrorHandler } from './shared/middleware/errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

  if (process.env.NODE_ENV === 'production') {
    const frontendDist =
      process.env.FRONTEND_DIST_DIR ?? path.resolve(__dirname, '../../frontend/dist');
    console.log(`[static] Serving frontend from ${frontendDist}`);
    app.use(express.static(frontendDist));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  }

  app.use(domainErrorHandler);

  return app;
}
