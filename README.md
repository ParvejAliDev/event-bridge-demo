# Event Bridge Demo

Local-first event processing demo with an app, Kafka, Postgres, and Redis.

## Quick Start

1. Review `.env`.
2. Run `docker compose up --build`.
3. Open `http://localhost:4000/health`.
4. Ingest events through `POST /events/ingest`.

## Useful Endpoints

- `POST /events/ingest`
- `POST /events/ingest?transport=direct`
- `GET /events/dead-letter`
- `POST /events/replay/:eventId`
- `GET /health`
- `GET /ready`
- `GET /metrics`

## Useful Command

- `npm run smoke` runs the local smoke check against an isolated Docker Compose stack.
