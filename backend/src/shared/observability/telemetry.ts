import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

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
    env.OTEL_EXPORTER_OTLP_ENDPOINT || env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
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
    // instrumentations: [] — HTTP/SQLite spans + privacy suppression land here later.
  });
  sdk.start();

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
