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
import { createBackupRouter } from './backup/http/routes.js';
import { createSettingsRouter } from './settings/http/routes.js';
import { DrizzleSettingsRepository } from './settings/infrastructure/DrizzleSettingsRepository.js';
import { domainErrorHandler } from './shared/middleware/errorHandler.js';
import { NotFoundError } from './shared/domain/errors/DomainError.js';
import { httpTelemetryMetrics } from './shared/observability/http-telemetry-metrics.js';
import {
  assertGateConfig,
  createAuthRouter,
  createGateMiddleware,
  readGateConfig,
} from './shared/auth/gate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:5173';

  // credentials: true so the browser stores and sends the gate session cookie
  // on cross-origin requests (frontend origin → API). Requires a concrete origin,
  // not '*', which corsOrigin already is.
  app.use(cors({ origin: corsOrigin, credentials: true }));
  app.use(express.json());
  app.use(httpTelemetryMetrics());

  app.get('/health', (_req, res) => {
    const body: HealthResponse = { ok: true };
    res.json(body);
  });

  const entryRepo = new DrizzleEntryRepository();
  const habitRepo = new DrizzleHabitDefinitionRepository(entryRepo);
  const userRepo = new DrizzleUserRepository({ seedFor: (id) => habitRepo.seedFor(id) });

  // All data-bearing endpoints live under /api so they never collide with the
  // SPA's client-side routes (e.g. GET /settings would otherwise return JSON
  // instead of the app shell on a deep-link/hard-reload in production).
  const gateConfig = readGateConfig();
  assertGateConfig(gateConfig);

  const api = express.Router();
  // Auth endpoints unlock the gate, so they must stay reachable while locked —
  // mount them before the gate middleware. Everything after it is protected.
  api.use('/auth', createAuthRouter(gateConfig));
  api.use(createGateMiddleware(gateConfig));
  api.use('/users', createUsersRouter(userRepo));
  api.use('/habit-definitions', createHabitDefinitionsRouter(habitRepo));
  api.use('/entries', createEntriesRouter(entryRepo));
  api.use('/metrics', createMetricsRouter());
  api.use('/export', createExportRouter());
  api.use('/backup', createBackupRouter(habitRepo, entryRepo));
  api.use('/settings', createSettingsRouter(new DrizzleSettingsRepository()));
  // Unknown API routes must 404 as JSON. Without this they'd fall through to the
  // SPA index.html fallback below and answer 200/HTML for a non-existent endpoint.
  api.use((req, _res, next) => {
    next(new NotFoundError(`Cannot ${req.method} ${req.originalUrl}`));
  });
  app.use('/api', api);

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
