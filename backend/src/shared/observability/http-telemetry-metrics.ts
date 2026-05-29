import { metrics } from '@opentelemetry/api';
import type { Counter, Histogram } from '@opentelemetry/api';
import type { RequestHandler } from 'express';

// Instruments are created lazily on first request so they are always bound to
// the SDK's MeterProvider (which registers itself globally during sdk.start()).
// When telemetry is disabled the global provider is a no-op and all operations
// are free.
let requestCounter: Counter | undefined;
let latencyHistogram: Histogram | undefined;
let errorCounter: Counter | undefined;

function instruments() {
  if (!requestCounter) {
    const meter = metrics.getMeter('habits-backend-http');
    requestCounter = meter.createCounter('http.server.request.count', {
      description: 'Total HTTP requests received',
    });
    latencyHistogram = meter.createHistogram('http.server.request.duration_ms', {
      description: 'HTTP request duration in milliseconds',
      unit: 'ms',
    });
    errorCounter = meter.createCounter('http.server.error.count', {
      description: 'HTTP requests resulting in a 5xx response',
    });
  }
  return { requestCounter: requestCounter!, latencyHistogram: latencyHistogram!, errorCounter: errorCounter! };
}

/**
 * Express middleware that records per-request telemetry metrics:
 * request count, latency distribution, and error count (5xx only).
 *
 * The route template is intentionally not captured here — the span name from
 * ExpressInstrumentation carries it, and adding it as a metric attribute would
 * risk high cardinality from unmapped paths. Only method + status code are used.
 *
 * When telemetry is disabled the global no-op MeterProvider makes all
 * instrument calls free.
 */
export function httpTelemetryMetrics(): RequestHandler {
  return (req, res, next) => {
    const startMs = Date.now();

    res.on('finish', () => {
      const { requestCounter, latencyHistogram, errorCounter } = instruments();
      const attrs = {
        'http.method': req.method,
        'http.status_code': res.statusCode,
      };
      const durationMs = Date.now() - startMs;

      requestCounter.add(1, attrs);
      latencyHistogram.record(durationMs, attrs);
      if (res.statusCode >= 500) {
        errorCounter.add(1, attrs);
      }
    });

    next();
  };
}
