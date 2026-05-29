import { describe, it, expect, afterEach } from 'vitest';
import { readTelemetryConfig, startTelemetry, shutdownTelemetry } from '../telemetry.js';

// readTelemetryConfig reads env at call time, so each test sets the vars it
// needs and restores the environment afterwards (mirrors the gate test).
const savedEnv: Record<string, string | undefined> = {};
function setEnv(key: string, value: string | undefined) {
  if (!(key in savedEnv)) savedEnv[key] = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

afterEach(async () => {
  await shutdownTelemetry();
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  for (const key of Object.keys(savedEnv)) delete savedEnv[key];
});

describe('Telemetry configuration', () => {
  it('is disabled when no OTLP destination is configured', () => {
    const config = readTelemetryConfig({ NODE_ENV: 'production' });
    expect(config.enabled).toBe(false);
  });

  it('is enabled when an OTLP endpoint is set outside of tests', () => {
    const config = readTelemetryConfig({
      NODE_ENV: 'production',
      OTEL_EXPORTER_OTLP_ENDPOINT: 'https://otlp.example.com',
    });
    expect(config.enabled).toBe(true);
  });

  it('is enabled by a traces-specific OTLP endpoint', () => {
    const config = readTelemetryConfig({
      NODE_ENV: 'production',
      OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: 'https://otlp.example.com/v1/traces',
    });
    expect(config.enabled).toBe(true);
  });

  it('stays inert under NODE_ENV=test even when an OTLP endpoint is set', () => {
    const config = readTelemetryConfig({
      NODE_ENV: 'test',
      OTEL_EXPORTER_OTLP_ENDPOINT: 'https://otlp.example.com',
    });
    expect(config.enabled).toBe(false);
  });

  it('defaults the service name and lets OTEL_SERVICE_NAME override it', () => {
    expect(readTelemetryConfig({}).serviceName).toBe('habits-backend');
    expect(readTelemetryConfig({ OTEL_SERVICE_NAME: 'habits-staging' }).serviceName).toBe(
      'habits-staging',
    );
  });
});

describe('Telemetry bootstrap', () => {
  it('does not start the SDK when telemetry is disabled', () => {
    expect(startTelemetry({ enabled: false, serviceName: 'habits-backend' })).toBe(false);
  });

  it('starts once and tolerates an unreachable OTLP endpoint without throwing', () => {
    // A configured-but-unreachable destination must not crash startup.
    setEnv('OTEL_EXPORTER_OTLP_ENDPOINT', 'http://127.0.0.1:1'); // nothing listening
    const config = { enabled: true, serviceName: 'habits-test' };

    expect(startTelemetry(config)).toBe(true);
    // start-once: a second call is a no-op that still reports "running".
    expect(startTelemetry(config)).toBe(true);
  });
});
