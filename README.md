# Event Bridge Demo

## Local Quick Start

1. Review `.env` and adjust values if needed.
2. Run `docker compose up --build`.
3. Open `http://localhost:4000/health`.
4. Use `npm run dev` outside Docker if you want to iterate on the service while keeping dependencies containerized.

## Included Surface

- Dockerized `app`, `kafka`, `postgres`, and `redis`
- Contract validation scaffold for order events
- Health endpoint and ingest endpoint
