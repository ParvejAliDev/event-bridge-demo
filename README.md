# Event Bridge Demo

Local-first event processing service.

## Local Quick Start

1. Review `.env`.
2. Run `docker compose up --build`.
3. Open `http://localhost:4000/health`.
4. Ingest events through `POST /events/ingest`.

## Included Local Surface

- Dockerized `app`, `kafka`, `postgres`, and `redis`.
- `POST /events/ingest` publishes validated events to Kafka by default.
- `POST /events/ingest?transport=direct` runs the same processing policy inline for quick local debugging.
- `GET /events/dead-letter` and `POST /events/replay/:eventId` expose DLQ visibility and replay.
- `GET /health`, `GET /ready`, and `GET /metrics` expose operational status.

## Deterministic Failure Simulation

Set `payload.failuresBeforeSuccess` on an event to exercise retry and dead-letter behavior locally. Example:

```json
{
  "eventId": "evt_local_1",
  "orderId": "ord_local_1",
  "type": "order.created",
  "occurredAt": "2026-06-05T00:00:00.000Z",
  "payload": {
    "failuresBeforeSuccess": 2
  }
}
```
