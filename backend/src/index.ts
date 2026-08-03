import 'dotenv/config';
// Must precede ./app.js so telemetry boots before any instrumentable module
// (express, http, better-sqlite3) loads. Inert unless an OTLP endpoint is set.
import './shared/observability/instrument.js';
import { createApp } from './app.js';
import { runMigrations } from './shared/db/migrate.js';
import { startIdempotencyKeyCleanup } from './entries/infrastructure/idempotencyKeyRetention.js';

runMigrations();
startIdempotencyKeyCleanup();

const app = createApp();
const port = Number(process.env.PORT ?? 3001);

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
