import { describe, it, expect, afterEach, vi } from 'vitest';
import { context, trace, SpanStatusCode } from '@opentelemetry/api';
import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import {
  LoggerProvider,
  InMemoryLogRecordExporter,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import type { Request, Response } from 'express';
import { domainErrorHandler } from '../errorHandler.js';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../domain/errors/DomainError.js';

// An in-memory provider lets us inspect span status without an OTLP backend.
const exporter = new InMemorySpanExporter();
const provider = new NodeTracerProvider({
  spanProcessors: [new SimpleSpanProcessor(exporter)],
});
provider.register();

// Likewise capture emitted log records so we can assert on the OTLP log output.
const logExporter = new InMemoryLogRecordExporter();
const loggerProvider = new LoggerProvider({
  processors: [new SimpleLogRecordProcessor(logExporter)],
});
logs.setGlobalLoggerProvider(loggerProvider);

function fakeReq(method = 'GET'): Request {
  return { method } as Request;
}

afterEach(() => {
  exporter.reset();
  logExporter.reset();
});

function fakeRes(): Response {
  const res = { status: () => res, json: () => res } as unknown as Response;
  return res;
}

describe('domainErrorHandler — span marking', () => {
  it('marks the active span ERROR when a ForbiddenError (403) is handled', () => {
    const tracer = provider.getTracer('test');
    const span = tracer.startSpan('test-span');

    context.with(trace.setSpan(context.active(), span), () => {
      domainErrorHandler(
        new ForbiddenError('cross-user access'),
        fakeReq(),
        fakeRes(),
        () => {},
      );
    });

    span.end();
    const finished = exporter.getFinishedSpans();
    expect(finished[0]?.status.code).toBe(SpanStatusCode.ERROR);
  });

  it('marks the active span ERROR when a NotFoundError (404) is handled', () => {
    const tracer = provider.getTracer('test');
    const span = tracer.startSpan('test-span');

    context.with(trace.setSpan(context.active(), span), () => {
      domainErrorHandler(
        new NotFoundError('habit not found'),
        fakeReq(),
        fakeRes(),
        () => {},
      );
    });

    span.end();
    const finished = exporter.getFinishedSpans();
    expect(finished[0]?.status.code).toBe(SpanStatusCode.ERROR);
  });

  it('marks the active span ERROR when an unexpected error is handled', () => {
    const tracer = provider.getTracer('test');
    const span = tracer.startSpan('test-span');
    const nextFn = vi.fn();

    context.with(trace.setSpan(context.active(), span), () => {
      domainErrorHandler(new Error('unexpected'), fakeReq(), fakeRes(), nextFn);
    });

    span.end();
    expect(nextFn).toHaveBeenCalledOnce(); // error forwarded to Express default handler
    const finished = exporter.getFinishedSpans();
    expect(finished[0]?.status.code).toBe(SpanStatusCode.ERROR);
  });

  it('does not throw when there is no active span', () => {
    // Telemetry disabled (no active span) — handler must be a no-op for span marking.
    expect(() => {
      domainErrorHandler(
        new ValidationError('invalid'),
        fakeReq(),
        fakeRes(),
        () => {},
      );
    }).not.toThrow();
  });
});

describe('domainErrorHandler — log emission', () => {
  it('emits a WARN log record for a handled DomainError', () => {
    domainErrorHandler(new NotFoundError('whatever'), fakeReq('POST'), fakeRes(), () => {});

    const records = logExporter.getFinishedLogRecords();
    expect(records).toHaveLength(1);
    expect(records[0]?.severityNumber).toBe(SeverityNumber.WARN);
    expect(records[0]?.attributes).toMatchObject({
      'error.type': 'NotFoundError',
      'http.status_code': 404,
      'http.method': 'POST',
    });
  });

  it('never exports the DomainError message (BR-002 — it can carry entity names)', () => {
    const secret = 'My private habit name';
    domainErrorHandler(new NotFoundError(secret), fakeReq(), fakeRes(), () => {});

    const record = logExporter.getFinishedLogRecords()[0];
    expect(record?.body).not.toContain(secret);
    expect(JSON.stringify(record?.attributes)).not.toContain(secret);
  });

  it('emits an ERROR log record with type and message for an unexpected error', () => {
    domainErrorHandler(
      new Error('database connection lost'),
      fakeReq('DELETE'),
      fakeRes(),
      () => {},
    );

    const records = logExporter.getFinishedLogRecords();
    expect(records).toHaveLength(1);
    expect(records[0]?.severityNumber).toBe(SeverityNumber.ERROR);
    expect(records[0]?.attributes).toMatchObject({
      'error.type': 'Error',
      'error.message': 'database connection lost',
      'http.method': 'DELETE',
    });
  });
});
