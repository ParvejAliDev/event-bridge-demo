# Event Bridge Demo

![NestJS](https://img.shields.io/badge/NestJS-11-e0234e?logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178c6?logo=typescript&logoColor=white)
![Kafka](https://img.shields.io/badge/Kafka-Confluent-231f20?logo=apachekafka&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169e1?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7.4-dc382d?logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ed?logo=docker&logoColor=white)

Event Bridge Demo is a local-first event-processing service that demonstrates how commerce order events can move through a Kafka-backed pipeline with contract validation, idempotent processing, retry handling, dead-letter visibility, replay, metrics, and a recruiter-friendly browser demo.

The project is intentionally more than a basic API. It models the operational concerns that make event-driven systems reliable: schema boundaries, duplicate suppression, durable processing state, observable failure paths, replayable dead-letter records, health probes, smoke automation, and a clean AWS migration map.

## What This Demonstrates

- Event-driven backend design with NestJS, KafkaJS, PostgreSQL, Redis, and Docker Compose.
- Contract-first ingestion using a Zod order-event schema at the API and consumer boundaries.
- Idempotency across duplicate events using a deterministic event key plus Redis TTL reservations.
- Durable processing state in PostgreSQL for processed events, attempts, retry schedules, DLQ records, and checkpoints.
- Explicit retry and dead-letter behavior that is visible through API endpoints, metrics, and the demo UI.
- A local development runtime that mirrors production service boundaries without requiring AWS.
- Recruiter-friendly proof of quality: 15 unit test files, CI checks, smoke testing, typed env validation, and documented architecture decisions.

## Table of Contents

- [Product Tour](#product-tour)
- [Architecture](#architecture)
- [Event Contract](#event-contract)
- [Processing Behavior](#processing-behavior)
- [Tech Stack](#tech-stack)
- [Data Model](#data-model)
- [Getting Started](#getting-started)
- [API Reference](#api-reference)
- [Useful Commands](#useful-commands)
- [Quality Gates](#quality-gates)
- [Project Structure](#project-structure)
- [Cloud Migration Path](#cloud-migration-path)
- [README Sources](#readme-sources)

## Product Tour

### Browser Demo

Open `http://localhost:4000` after the stack starts. The demo page exposes three event-processing scenarios:

| Scenario                | What it proves                                                                   |
| ----------------------- | -------------------------------------------------------------------------------- |
| Happy path              | A valid order event publishes to Kafka and settles as processed.                 |
| Retries then success    | A transient failure records retry attempts before the event succeeds.            |
| Dead-letter then replay | An event exhausts its retry budget, lands in the DLQ, then replays successfully. |

The demo page is backed by real service calls. It does not fake the pipeline: scenarios publish through Kafka, wait for settled processing state, then render attempts, DLQ status, duplicate behavior, and replay results.

### Event Ingestion

`POST /events/ingest` accepts validated order events. The default transport is Kafka, which publishes the event to the configured topic and lets the consumer process it asynchronously.

For local debugging, `POST /events/ingest?transport=direct` bypasses Kafka and invokes the processor immediately.

### Retry, DLQ, And Replay

The processor can simulate transient failures through the event payload field `failuresBeforeSuccess`. Retry attempts are recorded in PostgreSQL. If retry budget is exhausted, the event is written to `dead_letter_events` and becomes visible through the DLQ endpoint and demo UI.

Replay clears the Redis idempotency reservation for the event, reprocesses the original payload, and removes the dead-letter record after a successful replay.

### Observability

The service includes:

- `/health` for dependency-aware liveness.
- `/ready` for dependency-aware readiness.
- `/metrics` for Prometheus-style event counters.
- `/events/dead-letter` for operator-visible DLQ inspection.

## Architecture

```mermaid
flowchart LR
  Browser[Browser Demo] --> App[NestJS App]
  Client[API Client] --> App
  App --> Validator[Zod Event Contract]
  Validator --> Publisher[Kafka Publisher]
  Publisher --> Kafka[(Kafka Topic)]
  Kafka --> Consumer[Kafka Consumer]
  Consumer --> Processor[Processing Service]
  Processor --> Redis[(Redis Idempotency TTL)]
  Processor --> Postgres[(PostgreSQL State)]
  Processor --> DLQ[Dead Letter Records]
  DLQ --> Postgres
  Replay[Replay Endpoint] --> Processor
```

Runtime services:

| Service    | Responsibility                                                             |
| ---------- | -------------------------------------------------------------------------- |
| `app`      | NestJS API, browser demo, Kafka producer/consumer, processing service      |
| `kafka`    | Local single-broker Kafka transport using Confluent Platform in KRaft mode |
| `postgres` | Durable event processing state, attempts, retry schedules, DLQ records     |
| `redis`    | TTL-based duplicate suppression and transient coordination                 |

## Event Contract

Order events are validated with `src/modules/contracts/order-event.schema.ts`:

```json
{
  "eventId": "evt-1001",
  "orderId": "ord-1001",
  "type": "order.created",
  "occurredAt": "2026-07-19T12:00:00.000Z",
  "payload": {}
}
```

Supported event types:

- `order.created`
- `order.updated`
- `order.cancelled`
- `order.status.changed`

Demo-only failure simulation:

```json
{
  "payload": {
    "failuresBeforeSuccess": 2
  }
}
```

## Processing Behavior

1. Ingest validates the request body against the order-event schema.
2. Kafka transport publishes the event to `KAFKA_TOPIC`; direct transport calls the processor immediately.
3. The consumer validates Kafka message payloads before processing.
4. The processor creates a deterministic idempotency key from the event.
5. Redis reserves the idempotency key with `IDEMPOTENCY_TTL_SECONDS`.
6. PostgreSQL records attempts, processed state, retry schedules, and DLQ records.
7. Duplicate processed events return `duplicate` without creating a second processed result.
8. Replay removes the DLQ record only after the replayed event no longer dead-letters.

## Tech Stack

| Layer              | Tools                                                              |
| ------------------ | ------------------------------------------------------------------ |
| Framework          | NestJS 11                                                          |
| Language           | TypeScript 6                                                       |
| Event transport    | KafkaJS, Confluent Kafka Docker image                              |
| Database           | PostgreSQL 17                                                      |
| Cache/coordination | Redis 7.4                                                          |
| Validation         | Zod                                                                |
| Runtime            | Node.js 20, Docker Compose                                         |
| Quality            | ESLint, Prettier, TypeScript, Vitest, smoke script, GitHub Actions |

## Data Model

PostgreSQL tables are initialized through `docker/postgres/init.sql`:

- `processed_events`: current durable processing state for each event.
- `event_attempts`: attempt-by-attempt history with status and error message.
- `retry_schedules`: retry timing records and reasons.
- `dead_letter_events`: replayable events that exhausted retry budget.
- `consumer_checkpoints`: durable checkpoint shape for topic/partition offsets.
- `processing_audit_logs`: audit-log extension point for processing actions.

## Getting Started

### Prerequisites

- Node.js 20 or newer
- npm
- Docker with Docker Compose, or the standalone `docker-compose` binary

### 1. Configure Environment

Create `.env` from the example file:

```bash
cp .env.example .env
```

Default local values:

```dotenv
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://events_app:events_app@localhost:5432/order_events
REDIS_URL=redis://localhost:6379
KAFKA_CLIENT_ID=order-events-service
KAFKA_BROKERS=localhost:9092
KAFKA_TOPIC=order-events
KAFKA_CONSUMER_GROUP=order-events-local
PROCESSING_MAX_RETRIES=3
IDEMPOTENCY_TTL_SECONDS=300
```

### 2. Start The Full Local Stack

The runtime Compose file uses less collision-prone host ports for Kafka, PostgreSQL, and Redis:

```bash
docker compose -f docker-compose.runtime.yml up --build
```

Or with standalone Compose:

```bash
docker-compose -f docker-compose.runtime.yml up --build
```

The default `docker-compose.yml` is also available for a simpler local mapping.

### 3. Open The Demo

Visit:

```text
http://localhost:4000
```

## API Reference

### Ingest Event Through Kafka

```bash
curl -X POST http://localhost:4000/events/ingest \
  -H 'content-type: application/json' \
  -d '{
    "eventId": "evt-demo-1",
    "orderId": "ord-demo-1",
    "type": "order.created",
    "occurredAt": "2026-07-19T12:00:00.000Z",
    "payload": {}
  }'
```

### Ingest Event Directly

```bash
curl -X POST 'http://localhost:4000/events/ingest?transport=direct' \
  -H 'content-type: application/json' \
  -d '{
    "eventId": "evt-direct-1",
    "orderId": "ord-direct-1",
    "type": "order.updated",
    "occurredAt": "2026-07-19T12:00:00.000Z",
    "payload": {
      "failuresBeforeSuccess": 2
    }
  }'
```

### Inspect Dead-Letter Events

```bash
curl http://localhost:4000/events/dead-letter
```

### Replay A Dead-Letter Event

```bash
curl -X POST http://localhost:4000/events/replay/evt-direct-1
```

### Operational Endpoints

| Endpoint                                     | Purpose                                      |
| -------------------------------------------- | -------------------------------------------- |
| `GET /`                                      | Browser demo                                 |
| `POST /events/ingest`                        | Validate and publish/process an event        |
| `POST /events/ingest?transport=direct`       | Process an event without Kafka               |
| `GET /events/dead-letter`                    | List DLQ records                             |
| `POST /events/replay/:eventId`               | Replay a DLQ event                           |
| `GET /health`                                | Dependency-aware liveness                    |
| `GET /ready`                                 | Dependency-aware readiness                   |
| `GET /metrics`                               | Prometheus-style counters                    |
| `GET /demo/overview`                         | Demo health, metrics, and recent DLQ summary |
| `POST /demo/scenarios/:scenarioId`           | Run a browser-demo scenario                  |
| `POST /demo/scenarios/:scenarioId/replay`    | Replay a scenario event                      |
| `POST /demo/scenarios/:scenarioId/duplicate` | Send a duplicate scenario event              |

## Useful Commands

| Command                | Purpose                                                               |
| ---------------------- | --------------------------------------------------------------------- |
| `npm run dev`          | Run the NestJS app in watch mode                                      |
| `npm run build`        | Build the NestJS app                                                  |
| `npm run start`        | Start the compiled app from `dist/main`                               |
| `npm run lint`         | Run ESLint with zero-warning enforcement                              |
| `npm run typecheck`    | Run TypeScript without emitting files                                 |
| `npm run test`         | Run the Vitest suite                                                  |
| `npm run smoke`        | Boot an isolated Compose stack and verify Kafka, DLQ, and replay flow |
| `npm run format:check` | Check Prettier formatting                                             |
| `make up`              | Start the default Compose stack with build                            |
| `make down`            | Stop Compose services and remove orphans                              |

## Quality Gates

The repository includes a GitHub Actions workflow for `dev` pushes and pull requests. It runs:

- `npm ci`
- `npm run format:check`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`

The local test suite currently includes 15 unit test files covering retry policy, event schema validation, demo presentation, demo service/controller behavior, Kafka topic creation, processing policy, idempotency, timestamp serialization, app wiring, and smoke-script helpers.

The smoke script starts an isolated Compose project on free local ports, waits for `/ready`, verifies `/health`, publishes a Kafka event, waits for PostgreSQL processed state, publishes an event that dead-letters, replays it, verifies it becomes processed, confirms DLQ removal, and tears the stack down.

## Project Structure

```text
.
├── src/
│   ├── config/              # Typed environment parsing
│   ├── lib/                 # PostgreSQL, Redis, and timestamp helpers
│   ├── modules/
│   │   ├── consumers/       # Kafka consumer and topic setup
│   │   ├── contracts/       # Order event schema
│   │   ├── demo/            # Browser demo controllers, scenarios, presenter, view
│   │   ├── dlq/             # Dead-letter record helpers
│   │   ├── health/          # Health and readiness endpoints
│   │   ├── idempotency/     # Deterministic idempotency keys
│   │   ├── ingest/          # Event ingest endpoint
│   │   ├── metrics/         # Prometheus-style metrics
│   │   ├── processing/      # Processing service, policy, repository
│   │   ├── publishers/      # Kafka publisher
│   │   ├── replay/          # DLQ replay endpoint
│   │   └── retries/         # Retry decision policy
│   └── public/              # Browser demo assets
├── scripts/                 # Smoke test automation
├── tests/unit/              # Vitest unit tests
├── docker/postgres/         # Local PostgreSQL schema bootstrap
├── docs/                    # Architecture, AWS migration, research, demo specs
├── docker-compose.yml       # Default local runtime
├── docker-compose.runtime.yml # Runtime file preferred by smoke tests
└── .github/workflows/ci.yml # CI quality gate
```

## Cloud Migration Path

The service is local-first, but the boundaries map cleanly to AWS:

| Local Service | AWS Target                |
| ------------- | ------------------------- |
| `app`         | ECS/Fargate               |
| `kafka`       | Amazon MSK                |
| `postgres`    | Amazon RDS for PostgreSQL |
| `redis`       | Amazon ElastiCache        |

IAM, networking, secrets management, and topic lifecycle policies should be handled as deployment concerns. The local service behavior should remain the source of product truth.

## README Sources

This README follows public guidance that a strong project front page should explain what the project does, why it is useful, how to run it, and how reviewers can evaluate it:

- [GitHub Docs: About READMEs](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes)
- [Open Source Guides: Starting an Open Source Project](https://opensource.guide/starting-a-project/)
- [Make a README](https://www.makeareadme.com/)

## License

No open-source license is currently declared in this repository.
