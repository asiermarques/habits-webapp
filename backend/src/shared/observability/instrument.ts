import { startTelemetry } from './telemetry.js';

/**
 * Side-effect entry point for telemetry bootstrap.
 *
 * `src/index.ts` imports this module *first* — before `./app.js` and therefore
 * before any instrumentable module (express, the `http` core module,
 * better-sqlite3) is loaded — so the OpenTelemetry instrumentations added later
 * can patch them at require time. (`dotenv/config` still runs ahead of it so
 * the `OTEL_*` env vars are populated before we read them.)
 *
 * When telemetry is unconfigured or running under `NODE_ENV=test` this is a
 * no-op: the SDK is never created and startup is identical to today.
 */
const started = startTelemetry();
if (started) {
  console.log('[telemetry] OpenTelemetry SDK started — exporting to the configured OTLP endpoint');
}
