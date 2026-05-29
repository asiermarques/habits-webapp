import { describe, it, expect, afterEach, vi } from 'vitest';
import { context, trace, SpanStatusCode } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
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

afterEach(() => {
  exporter.reset();
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
        {} as Request,
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
        {} as Request,
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
      domainErrorHandler(new Error('unexpected'), {} as Request, fakeRes(), nextFn);
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
        {} as Request,
        fakeRes(),
        () => {},
      );
    }).not.toThrow();
  });
});
