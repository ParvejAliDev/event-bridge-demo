# Event Bridge Demo Recruiter UI Design

## Goal

Add a recruiter-friendly UI to `event-bridge-demo` so a reviewer can understand the system story quickly and see that the event pipeline works end to end without reading raw API docs first.

## Audience

- Primary: recruiters and hiring managers
- Secondary: engineers who want technical proof after the first pass

## Outcome We Want To Convey

1. The service accepts real order events.
2. Events move through a realistic bridge flow: ingest, Kafka, consumer, processing outcome.
3. The system handles reliability concerns intentionally: retries, dead-lettering, replay, and idempotency.
4. Operational visibility exists, but it supports the story instead of overwhelming it.

## Recommended Product Shape

- Keep the UI inside the existing Nest app.
- Make `/` the recruiter-facing demo page.
- Preserve the current API and operational endpoints.
- Add a small demo-specific module that shapes existing backend behavior into presentation-ready responses.
- Avoid a separate frontend app, SPA router, or client-side state framework.

## Experience Summary

The first screen should feel like a polished product demo rather than an internal admin dashboard.

The page should:

- explain the system in plain language
- show the event journey visually
- let the recruiter trigger one of a few guided scenarios
- reveal the real outcome from the existing backend pipeline
- tuck raw technical detail into expandable sections

## Page Structure

### 1. Hero

- Clear headline describing the system as a local event bridge demo
- Short supporting sentence explaining that the page shows how order events move from ingest to outcome
- Visual event-flow strip:
  - `Ingest`
  - `Kafka`
  - `Consumer`
  - `Outcome`

### 2. Guided Scenario Controls

Three large scenario cards act as the primary interaction:

- `Happy path`
- `Retries then success`
- `Dead-letter then replay`

Each card explains what it demonstrates in non-jargony language.

### 3. Event Journey Result

After a scenario runs, the page centers on a visual timeline or stepper showing:

- request accepted
- event published
- event consumed
- retry attempts when applicable
- final outcome
- replay outcome when applicable

The final state should be visually prominent.

### 4. Reliability Proof

A compact secondary section summarizes:

- event ID
- order ID
- transport
- attempt count
- final status
- failure reason when present
- duplicate detection outcome when triggered

### 5. Technical Details

Expandable sections hold:

- health and readiness
- dead-letter queue records
- raw request payload
- normalized response JSON
- metrics summary

These sections are visible on the page but collapsed by default.

## Main Interaction Model

The page is narrative first. A recruiter should not need to compose JSON or browse tabs to understand the system.

Primary interaction:

- click a guided scenario
- watch the event journey render
- optionally inspect the technical details

Secondary interaction:

- replay a dead-lettered event from the latest scenario
- resend the last event as a duplicate to demonstrate idempotency

## Scenario Definitions

All guided scenarios should use the real backend processing flow. The UI must not simulate outcomes on its own.

### Happy Path

Intent:

- prove the normal flow works end to end

Input shape:

- `type: order.created`
- no simulated failure count

Expected outcome:

- accepted
- published to Kafka
- consumed
- processed on the first attempt

### Retries Then Success

Intent:

- show transient failure handling and eventual success

Input shape:

- `type: order.updated`
- `payload.failuresBeforeSuccess = 2`

Expected outcome:

- accepted
- published to Kafka
- retry on attempts 1 and 2
- processed on attempt 3

### Dead-Letter Then Replay

Intent:

- show retry budget exhaustion, DLQ visibility, and recovery by replay

Input shape:

- `type: order.cancelled`
- `payload.failuresBeforeSuccess = 4`
- retry budget remains `3`

Expected outcome:

- accepted
- published to Kafka
- retries until the budget is exhausted
- dead-letter on attempt 4
- replay action becomes available
- replay succeeds on attempt 5
- event disappears from the dead-letter list after successful replay

### Duplicate Follow-Up Action

Intent:

- show idempotency without cluttering the first-run story

Behavior:

- after a successful run, offer `Send duplicate`
- resend the same event ID
- expect `duplicate` from the processing layer

## Backend Design

### Existing Endpoints To Keep

- `POST /events/ingest`
- `GET /events/dead-letter`
- `POST /events/replay/:eventId`
- `GET /health`
- `GET /ready`
- `GET /metrics`

### New Demo Endpoints

#### `GET /`

Returns the recruiter-facing HTML page.

#### `GET /demo/overview`

Returns presentation-ready JSON for the page, including:

- health status
- readiness status
- processed counts by status
- dead-letter queue count
- recent dead-letter records

#### `POST /demo/scenarios/:scenarioId`

Runs one curated scenario and returns normalized UI data for the latest run.

Expected response fields:

- scenario ID
- event summary
- timeline steps
- final outcome
- attempt count
- failure reason if present
- dead-letter record if present
- replay availability
- duplicate action metadata

#### `POST /demo/scenarios/:scenarioId/replay`

Only used for the dead-letter scenario after a run has landed in the DLQ.

Returns:

- replay outcome
- updated attempt count
- whether the dead-letter record was cleared
- updated timeline steps

#### `POST /demo/scenarios/:scenarioId/duplicate`

Resends the last event ID for the current run and returns the duplicate outcome.

## Implementation Boundaries

- Reuse the current processing pipeline as the system of record.
- Keep scenario construction in a dedicated demo module.
- Do not couple the page directly to Prometheus text parsing in the browser.
- Query repository-backed metrics and dead-letter records on the server side.
- Add minimal repository helpers for timeline data if the current repository layer does not expose enough run detail.

## Rendering Approach

Use a simple built-in page served by Nest:

- `DemoController` returns the page shell for `/`
- a small static CSS file handles the presentation
- a small static JS file handles scenario submission, timeline updates, and panel toggles

This keeps the demo easy to run in Docker Compose and avoids introducing a second web stack.

## Likely Files

- `src/modules/demo/demo.controller.ts`
- `src/modules/demo/demo.service.ts`
- `src/modules/demo/scenarios.ts`
- `src/modules/demo/view.ts`
- `src/public/demo.css`
- `src/public/demo.js`
- `src/modules/processing/repository.ts`
- `src/app.module.ts`
- `src/main.ts`

## Visual Direction

- polished showcase tone rather than admin-tool tone
- warm neutral background
- one strong accent color
- expressive but readable typography
- clear spacing and restrained motion
- diagram-like connectors between steps
- mobile layout stays linear and readable

The page should look intentional and memorable, not generic.

## Testing Plan

### Unit Coverage

- scenario definitions produce valid event payloads
- normalized demo responses map backend outcomes correctly
- timeline generation reflects processed, retry, dead-letter, replay, and duplicate states

### Controller Coverage

- `GET /` returns the page
- `GET /demo/overview` returns expected summary fields
- `POST /demo/scenarios/:scenarioId` returns correct outcomes for each scenario
- replay endpoint succeeds after the DLQ scenario
- duplicate endpoint returns `duplicate`

### Regression Coverage

- happy path ends `processed`
- retry scenario ends `processed` after multiple attempts
- dead-letter scenario lands in the DLQ
- replay clears the DLQ entry when the replay succeeds
- duplicate resend does not reprocess the event

## Non-Goals

- authentication
- multi-user state
- historical analytics dashboard
- websockets or live streaming
- generic JSON editor as the main experience
- separate frontend application

## Risks And Mitigations

### Risk: Broker timing makes the UI feel inconsistent

Mitigation:

- the demo scenario endpoint should poll for the resulting processed state for a short bounded interval before returning a final payload

### Risk: Raw technical details clutter the main story

Mitigation:

- keep details collapsed by default and structure them as supporting proof

### Risk: Replay behavior is misunderstood

Mitigation:

- clearly label the dead-letter scenario as a retry-budget exhaustion case, then surface replay as a deliberate recovery action

## Success Criteria

- a recruiter can understand the product story in under one minute
- the page demonstrates a real event run without needing curl or Postman
- reliability behavior is visible without turning the page into an operator dashboard
- the app still runs as one local service entrypoint in Docker Compose
