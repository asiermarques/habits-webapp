import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { metrics } from '@opentelemetry/api';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_URL_FULL, ATTR_URL_QUERY } from '@opentelemetry/semantic-conventions';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { BetterSqlite3Instrumentation } from 'opentelemetry-plugin-better-sqlite3';
import type { IncomingMessage } from 'http';

/**
 * Telemetry / Observability bootstrap.
 *
 * A cross-cutting concern — like the instance gate in `shared/auth/` — not a
 * vertical slice: no domain/infrastructure/http layering and no DB table. It
 * wires the OpenTelemetry SDK into backend startup, driven entirely by the
 * standard `OTEL_*` environment variables (the `dotenv` convention used for
 * `GATE_PASSWORD` / `DATABASE_URL`).
 *
 * Note the deliberate naming: this is **Telemetry / Observability**. The word
 * "Metrics" stays reserved for the habit Metrics product domain; observability
 * counters are "telemetry metrics".
 *
 * This is the bootstrap only — no spans, telemetry metrics, or logs are emitted
 * yet. HTTP/SQLite instrumentation with privacy suppression, telemetry metrics,
 * and correlated logs are built on top of it.
 */
export type TelemetryConfig = {
  /** Whether the OpenTelemetry SDK should start. False ⇒ fully inert. */
  enabled: boolean;
  /** `service.name` resource attribute reported to the OTLP backend. */
  serviceName: string;
};

/**
 * Reads telemetry enablement from the environment. Fail-open: telemetry is on
 * **only** when an OTLP destination is configured — mirroring the instance
 * gate, where an unset `GATE_PASSWORD` disables the gate.
 *
 * The OTLP endpoint, headers (treated as secrets), protocol, and sampling are
 * read straight from the standard `OTEL_EXPORTER_OTLP_*` / `OTEL_*` vars by the
 * SDK and exporter, so we don't re-plumb them here — we only decide on/off.
 */
export function readTelemetryConfig(env: NodeJS.ProcessEnv = process.env): TelemetryConfig {
  const otlpConfigured = Boolean(
    env.OTEL_EXPORTER_OTLP_ENDPOINT ||
      env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ||
      env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT ||
      env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT,
  );

  // Config-free tests: never start under `NODE_ENV=test`, even if an operator
  // leaves OTLP vars in their shell — keeping the suite hermetic.
  const enabled = otlpConfigured && env.NODE_ENV !== 'test';

  return {
    enabled,
    serviceName: env.OTEL_SERVICE_NAME || 'habits-backend',
  };
}

let sdk: NodeSDK | undefined;
let shutdownHooked = false;

/**
 * Starts the OpenTelemetry SDK once, if telemetry is enabled. Idempotent and
 * safe to call when disabled — returns whether the SDK is now running so the
 * caller can log a single startup line.
 *
 * A configured-but-unreachable OTLP endpoint must not crash startup:
 * `sdk.start()` only registers providers locally; export is batched and async,
 * and the batch processor swallows transport failures out-of-band — so a bad
 * endpoint can never block boot or request handling.
 */
export function startTelemetry(config: TelemetryConfig = readTelemetryConfig()): boolean {
  if (sdk) return true; // already started — start-once
  if (!config.enabled) return false;

  sdk = new NodeSDK({
    resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: config.serviceName }),
    traceExporter: new OTLPTraceExporter(),
    metricReaders: [
      new PeriodicExportingMetricReader({ exporter: new OTLPMetricExporter() }),
    ],
    logRecordProcessors: [new BatchLogRecordProcessor(new OTLPLogExporter())],
    instrumentations: [
      new HttpInstrumentation({
        // BR-002: Strip query strings from URL attributes so that query params
        // (userId filters, cursor tokens) never reach the telemetry backend.
        // Request/response bodies are not captured by this instrumentation by default.
        requestHook: (span, request) => {
          const url = (request as IncomingMessage).url;
          if (!url) return;
          const qIdx = url.indexOf('?');
          if (qIdx < 0) return;
          const pathOnly = url.slice(0, qIdx);
          span.setAttribute(ATTR_URL_FULL, pathOnly);
          span.setAttribute(ATTR_URL_QUERY, '');
          span.setAttribute('http.url', pathOnly); // legacy attribute for older receivers
        },
      }),
      // ExpressInstrumentation enriches HTTP spans with the route template
      // (e.g. /api/entries/:entryId) rather than the raw URL, giving low-cardinality
      // span names and keeping ids out of the span name.
      new ExpressInstrumentation(),
      // BetterSqlite3Instrumentation records the SQL template and operation as child
      // spans nested under the request span. Bound parameter values are never captured.
      new BetterSqlite3Instrumentation(),
    ],
  });
  sdk.start();

  registerProcessMetrics();
  registerShutdownHook();
  return true;
}

/**
 * Flushes and stops the SDK. No-op when telemetry never started. Swallows
 * shutdown errors so teardown can't crash the process.
 */
export async function shutdownTelemetry(): Promise<void> {
  if (!sdk) return;
  const current = sdk;
  sdk = undefined;
  try {
    await current.shutdown();
  } catch (err) {
    console.error('[telemetry] error during shutdown', err);
  }
}

/** Registers observable gauges for basic process/runtime telemetry metrics. */
function registerProcessMetrics(): void {
  const meter = metrics.getMeter('habits-backend-process');

  meter
    .createObservableGauge('process.memory.heap_used_bytes', {
      description: 'Heap memory in use by the V8 engine, in bytes',
      unit: 'By',
    })
    .addCallback((obs) => obs.observe(process.memoryUsage().heapUsed));

  meter
    .createObservableGauge('process.memory.rss_bytes', {
      description: 'Resident set size of the process, in bytes',
      unit: 'By',
    })
    .addCallback((obs) => obs.observe(process.memoryUsage().rss));

  meter
    .createObservableGauge('process.uptime_seconds', {
      description: 'Number of seconds the process has been running',
      unit: 's',
    })
    .addCallback((obs) => obs.observe(process.uptime()));
}

/** Flush pending spans on the usual termination signals (registered once). */
function registerShutdownHook(): void {
  if (shutdownHooked) return;
  shutdownHooked = true;
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(signal, () => {
      void shutdownTelemetry().finally(() => process.exit(0));
    });
  }
}
