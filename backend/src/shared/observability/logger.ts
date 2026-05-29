import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import { trace } from '@opentelemetry/api';

/**
 * Structured logger for the backend.
 *
 * Each log call emits an OpenTelemetry log record (exported over OTLP when
 * telemetry is enabled) AND prints to the console so local dev and tests keep
 * their existing output. The OTel log record automatically carries the active
 * trace and span IDs when called within a request handler, enabling pivot from
 * trace to correlated log lines in the managed backend.
 *
 * Privacy (BR-002): callers must not pass Entry Data, Cost Spent, habit names,
 * or User names in the `attrs` map — the same rule that applies to span
 * attributes.
 *
 * When telemetry is disabled (no OTLP endpoint configured) the global
 * LoggerProvider is a no-op, so only the console output runs.
 */

export type LogAttrs = Record<string, string | number | boolean>;

type Level = 'debug' | 'info' | 'warn' | 'error';

const severityOf: Record<Level, SeverityNumber> = {
  debug: SeverityNumber.DEBUG,
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
};

function activeTraceContext(): Record<string, string> {
  const span = trace.getActiveSpan();
  if (!span) return {};
  const ctx = span.spanContext();
  return { trace_id: ctx.traceId, span_id: ctx.spanId };
}

function emit(level: Level, message: string, attrs?: LogAttrs): void {
  const traceCtx = activeTraceContext();

  // Emit an OTel log record — no-op when the LoggerProvider is unregistered.
  logs.getLogger('habits-backend').emit({
    severityNumber: severityOf[level],
    severityText: level.toUpperCase(),
    body: message,
    attributes: { ...traceCtx, ...attrs },
  });

  // Console output so the log is visible in dev and test regardless of telemetry.
  const entry: Record<string, unknown> = { level, message, ...traceCtx, ...attrs };
  const consoleFn =
    level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;

  if (process.env.NODE_ENV === 'production') {
    consoleFn(JSON.stringify(entry));
  } else {
    const prefix = `[${level.toUpperCase()}]`;
    if (attrs && Object.keys(attrs).length > 0) {
      consoleFn(prefix, message, attrs);
    } else {
      consoleFn(prefix, message);
    }
  }
}

export const logger = {
  debug: (message: string, attrs?: LogAttrs) => emit('debug', message, attrs),
  info: (message: string, attrs?: LogAttrs) => emit('info', message, attrs),
  warn: (message: string, attrs?: LogAttrs) => emit('warn', message, attrs),
  error: (message: string, attrs?: LogAttrs) => emit('error', message, attrs),
};
