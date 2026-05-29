# Observability (Telemetry)

How to turn on backend observability for a deployed Habits instance and ship it
to a managed backend over **OTLP** (OpenTelemetry Protocol).

> **Naming.** This concern is called **Telemetry / Observability** everywhere in
> code, config, and docs. The word **Metrics** is reserved for the habit
> *Metrics* product feature (`/metrics`, Summary Cards, `/api/metrics/*`).
> Observability counters are called **telemetry metrics** to keep the two apart.

## What it is

Telemetry is a **cross-cutting concern**, like the [instance
gate](./ARCHITECTURE.md#instance-password-gate) — wiring, not a product feature,
and it adds **no user-visible behaviour**. Today it exists so the operator can
answer "is this instance healthy and how is it performing?" without SSH-ing in
to read stdout.

It is the **vendor-neutral OpenTelemetry + OTLP pipeline** for the backend,
exporting to any compatible managed backend — Grafana Cloud, Honeycomb, Dash0,
Datadog, an OpenTelemetry Collector, etc. — by configuration alone, with no code
change. The signals it is built to carry are request traces, runtime/HTTP
telemetry metrics, and structured logs.

Those operational signals are exactly the SLIs you build **SLOs** on (request
latency, error rate, throughput). Treat the pipeline as a foundation, not a
ceiling: it can also carry **aggregate business / product metrics** for SLOs
(e.g. entries logged per day, instance-level usage) by adding explicit
OpenTelemetry instruments. That is a deliberate, supported direction.

## Current scope and boundaries

What is implemented today: the SDK **bootstrap** and its fail-open env
configuration (this doc). The SDK initialises and connects to the configured
OTLP backend, but no spans, telemetry metrics, or logs are emitted yet — that
instrumentation is built on top of this foundation.

What this work deliberately leaves out — boundaries of *the current scope*, not
permanent limits on observability:

- **No self-hosted stack** — no Prometheus/Grafana/Loki containers are added to
  `docker-compose.yml`; export targets a managed backend (the single-instance,
  zero-ops ethos). Dashboards and alert/SLO rules are configured there.
- **No frontend / browser telemetry** — backend only.
- **No raw business/product metrics yet** — the aggregate business metrics noted
  above are a supported extension, not part of the current scope.

The one boundary that is **permanent, not scope-bound** is privacy (see below):
because the instance is unauthenticated and multi-user, telemetry must never
carry per-user **behavioural analytics** or any PII — **including** any future
business-metric work, which must stay **aggregate** and free of Entry Data,
costs, habit names, or User names.

## Fail-open: off unless you configure it

Telemetry is **opt-in and fail-open**, mirroring the instance gate:

- If **no OTLP endpoint** environment variable is set, the OpenTelemetry SDK is
  never created. Startup, request handling, and overhead are **identical to a
  build without telemetry**.
- Under `NODE_ENV=test` telemetry is **always inert**, even if OTLP variables
  are present, so the test suite stays hermetic and config-free.
- A configured-but-**unreachable** endpoint never blocks startup or request
  handling — export is batched and asynchronous, and transport failures are
  swallowed out-of-band.

Enabling telemetry is therefore a **deployment-time configuration change only**:
no code edit, no rebuild. To roll back, unset the endpoint variable and restart.

## Enabling it

Telemetry turns on as soon as an OTLP **endpoint** is configured. Set the
standard OpenTelemetry environment variables in the backend environment
(`backend/.env` locally, or your platform's secret/env store in production):

| Variable | Required | Purpose |
| --- | --- | --- |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | to enable | Base OTLP endpoint, e.g. `https://otlp.example.com`. The exporter appends the signal path (`/v1/traces`, …). **Presence of this (or the traces-specific variant below) is the on/off switch.** |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | optional | Per-signal override; must include the full path (`…/v1/traces`). Also enables telemetry on its own. |
| `OTEL_EXPORTER_OTLP_HEADERS` | usually | Auth headers for the managed backend, e.g. `api-key=...` or `Authorization=Bearer ...`. **Treat as a secret** (see below). |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | optional | Defaults to `http/protobuf` (the bundled exporter). Set if your backend needs `grpc`. |
| `OTEL_SERVICE_NAME` | optional | `service.name` reported to the backend. Defaults to `habits-backend`. Use this to distinguish instances (e.g. `habits-staging`). |
| `OTEL_TRACES_SAMPLER` / `OTEL_TRACES_SAMPLER_ARG` | optional | Sampling strategy/rate for production (e.g. `parentbased_traceidratio` + `0.1`). |

These are read straight from the environment by the OpenTelemetry SDK and
exporter in the same `dotenv` style as `GATE_PASSWORD` / `DATABASE_URL`.

### Example (`backend/.env`)

```sh
OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp.eu.example-vendor.com
OTEL_EXPORTER_OTLP_HEADERS=api-key=REPLACE_ME
OTEL_SERVICE_NAME=habits-prod
```

On boot you should see a single line confirming startup:

```
[telemetry] OpenTelemetry SDK started — exporting to the configured OTLP endpoint
```

No such line (and no errors) means telemetry is disabled — the expected state
for local dev and tests.

## Secrets

OTLP endpoint credentials (`OTEL_EXPORTER_OTLP_HEADERS`, API keys, tokens) are
**secrets**. Inject them via your platform's secret store / environment, exactly
like `SESSION_SECRET`. Never commit them — `backend/.env` is git-ignored and
`backend/.env.example` carries placeholders only.

## Privacy — what is *never* exported

The instance is **unauthenticated and multi-user**, so privacy is the
load-bearing requirement. Exported telemetry must **never** contain:

- **Entry Data** or **Cost Spent**,
- habit names,
- **User** names or any personal data.

Only operational attributes are exported: route templates, HTTP status,
duration, and error class. Request/response bodies, query parameters, and SQL
arguments must be **suppressed** and must never appear in any span, telemetry
metric, or log — including once instrumentation is added on top of the current
bootstrap, which on its own emits nothing.

## How it's wired

The bootstrap lives in `backend/src/shared/observability/` (alongside
`shared/auth/`), as a cross-cutting concern with no domain/infrastructure layer
and no DB table. `src/index.ts` imports `observability/instrument.ts` **before**
`app.ts`, so the SDK initialises before any instrumentable module (express,
`http`, better-sqlite3) loads — the ordering auto-instrumentation needs to patch
them. The `createApp()` / `index.ts` split is preserved, so `supertest` still
constructs the app without binding a port.

## Operating notes

- **Single-instance, zero-ops ethos**: export targets a *managed* backend; no
  new long-running services are added to the deployment.
- **`GET /health`** remains the un-gated liveness check at the root path and is
  unaffected by telemetry.
- **Shutdown**: on `SIGTERM`/`SIGINT` the SDK flushes pending spans before the
  process exits.
