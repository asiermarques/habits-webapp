import type { ErrorRequestHandler } from 'express';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { DomainError } from '../domain/errors/DomainError.js';

export const domainErrorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (err instanceof DomainError) {
    // Mark the active span errored so the trace reflects the HTTP error status.
    // The error message is intentionally omitted from the span to satisfy BR-002
    // (DomainError messages can reference domain entity names).
    trace.getActiveSpan()?.setStatus({ code: SpanStatusCode.ERROR });
    res.status(err.httpStatus).json({ error: err.message });
    return;
  }
  // Unexpected errors also errored — mark span before Express's default 500 handler.
  trace.getActiveSpan()?.setStatus({ code: SpanStatusCode.ERROR });
  next(err);
};
