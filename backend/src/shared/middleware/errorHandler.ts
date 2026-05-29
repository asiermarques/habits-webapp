import type { ErrorRequestHandler } from 'express';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { DomainError } from '../domain/errors/DomainError.js';
import { logger } from '../observability/logger.js';

export const domainErrorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (err instanceof DomainError) {
    // Mark the active span errored so the trace reflects the HTTP error status.
    // The error message is intentionally omitted from the span to satisfy BR-002
    // (DomainError messages can reference domain entity names).
    trace.getActiveSpan()?.setStatus({ code: SpanStatusCode.ERROR });
    // Log the expected 4xx for visibility/SLOs. BR-002: the class name and
    // status are operational; the message is omitted because it can reference
    // domain entity names (habit names, user names).
    logger.warn('Request rejected', {
      'error.type': err.constructor.name,
      'http.status_code': err.httpStatus,
      'http.method': req.method,
    });
    res.status(err.httpStatus).json({ error: err.message });
    return;
  }
  // Unexpected errors also errored — mark span before Express's default 500 handler.
  trace.getActiveSpan()?.setStatus({ code: SpanStatusCode.ERROR });
  // Unexpected (non-domain) errors are operational, not user data, so the
  // type and message are safe to export — this is exactly what you want in Loki.
  logger.error('Unhandled error', {
    'error.type': err instanceof Error ? err.name : typeof err,
    'error.message': err instanceof Error ? err.message : String(err),
    'http.method': req.method,
  });
  next(err);
};
