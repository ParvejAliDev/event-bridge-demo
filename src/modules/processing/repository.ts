import { getSql } from '../../lib/db';
import { serializeTimestamp } from '../../lib/timestamps';
import type { OrderEvent } from '../contracts/order-event.schema';

export type ProcessedEventRecord = {
  eventId: string;
  orderId: string;
  eventType: string;
  status: 'processed' | 'retrying' | 'dead_lettered';
  payload: OrderEvent['payload'];
  attemptCount: number;
  lastError: string | null;
  processedAt: Date | string;
};

export async function findProcessedEvent(
  eventId: string,
): Promise<ProcessedEventRecord | null> {
  const sql = getSql();
  const rows = await sql<ProcessedEventRecord[]>`
    select
      event_id as "eventId",
      order_id as "orderId",
      event_type as "eventType",
      status,
      payload,
      attempt_count as "attemptCount",
      last_error as "lastError",
      processed_at as "processedAt"
    from processed_events
    where event_id = ${eventId}
    limit 1
  `;

  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    ...row,
    processedAt: serializeTimestamp(row.processedAt),
  };
}

export type EventAttemptRecord = {
  attemptNumber: number;
  createdAt: string;
  errorMessage: string | null;
  status: 'processed' | 'retry' | 'dead_letter';
};

export async function listEventAttempts(
  eventId: string,
): Promise<EventAttemptRecord[]> {
  const sql = getSql();
  const rows = await sql<
    Array<{
      attemptNumber: number;
      createdAt: Date | string;
      errorMessage: string | null;
      status: 'processed' | 'retry' | 'dead_letter';
    }>
  >`
    select
      attempt_number as "attemptNumber",
      created_at as "createdAt",
      error_message as "errorMessage",
      status
    from event_attempts
    where event_id = ${eventId}
    order by attempt_number asc
  `;

  return rows.map((row) => ({
    ...row,
    createdAt: serializeTimestamp(row.createdAt),
  }));
}

export async function recordEventAttempt(input: {
  eventId: string;
  attemptNumber: number;
  status: 'processed' | 'retry' | 'dead_letter';
  errorMessage?: string;
}): Promise<void> {
  const sql = getSql();

  await sql`
    insert into event_attempts (
      event_id,
      attempt_number,
      status,
      error_message
    )
    values (
      ${input.eventId},
      ${input.attemptNumber},
      ${input.status},
      ${input.errorMessage ?? null}
    )
  `;
}

export async function upsertProcessedEvent(input: {
  event: OrderEvent;
  status: 'processed' | 'retrying' | 'dead_lettered';
  attemptCount: number;
  lastError?: string;
}): Promise<void> {
  const sql = getSql();

  await sql`
    insert into processed_events (
      event_id,
      order_id,
      event_type,
      status,
      payload,
      attempt_count,
      last_error
    )
    values (
      ${input.event.eventId},
      ${input.event.orderId},
      ${input.event.type},
      ${input.status},
      ${sql.json(input.event.payload)},
      ${input.attemptCount},
      ${input.lastError ?? null}
    )
    on conflict (event_id)
    do update set
      order_id = excluded.order_id,
      event_type = excluded.event_type,
      status = excluded.status,
      payload = excluded.payload,
      attempt_count = excluded.attempt_count,
      last_error = excluded.last_error,
      processed_at = now()
  `;
}

export async function addRetrySchedule(input: {
  eventId: string;
  nextAttemptAt: Date;
  reason: string;
}): Promise<void> {
  const sql = getSql();

  await sql`
    insert into retry_schedules (event_id, next_attempt_at, reason)
    values (${input.eventId}, ${input.nextAttemptAt.toISOString()}, ${input.reason})
  `;
}

export async function addDeadLetterEvent(input: {
  event: OrderEvent;
  reason: string;
}): Promise<void> {
  const sql = getSql();

  await sql`
    insert into dead_letter_events (event_id, reason, payload)
    values (
      ${input.event.eventId},
      ${input.reason},
      ${sql.json(input.event)}
    )
    on conflict (event_id)
    do update set
      reason = excluded.reason,
      payload = excluded.payload,
      created_at = now()
  `;
}

export async function listDeadLetterEvents(limit = 20): Promise<
  Array<{
    eventId: string;
    reason: string;
    payload: OrderEvent;
    createdAt: string;
  }>
> {
  const sql = getSql();

  const rows = await sql<
    Array<{
      eventId: string;
      reason: string;
      payload: OrderEvent;
      createdAt: Date | string;
    }>
  >`
    select
      event_id as "eventId",
      reason,
      payload,
      created_at as "createdAt"
    from dead_letter_events
    order by created_at desc
    limit ${limit}
  `;

  return rows.map((row) => ({
    ...row,
    createdAt: serializeTimestamp(row.createdAt),
  }));
}

export async function findDeadLetterEvent(eventId: string): Promise<{
  createdAt: string;
  eventId: string;
  payload: OrderEvent;
  reason: string;
} | null> {
  const sql = getSql();
  const rows = await sql<
    Array<{
      eventId: string;
      reason: string;
      payload: OrderEvent;
      createdAt: Date | string;
    }>
  >`
    select
      event_id as "eventId",
      reason,
      payload,
      created_at as "createdAt"
    from dead_letter_events
    where event_id = ${eventId}
    limit 1
  `;

  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    ...row,
    createdAt: serializeTimestamp(row.createdAt),
  };
}

export async function removeDeadLetterEvent(eventId: string): Promise<void> {
  const sql = getSql();

  await sql`
    delete from dead_letter_events
    where event_id = ${eventId}
  `;
}

export async function countProcessingMetrics(): Promise<{
  processed: number;
  retrying: number;
  deadLettered: number;
  deadLetterQueue: number;
}> {
  const sql = getSql();
  const processedRows = await sql<
    Array<{ status: 'processed' | 'retrying' | 'dead_lettered'; count: string }>
  >`
    select status, count(*)::text as count
    from processed_events
    group by status
  `;
  const deadLetterRows = await sql<Array<{ count: string }>>`
    select count(*)::text as count
    from dead_letter_events
  `;

  return processedRows.reduce(
    (summary, row) => {
      if (row.status === 'processed') {
        summary.processed = Number(row.count);
      }

      if (row.status === 'retrying') {
        summary.retrying = Number(row.count);
      }

      if (row.status === 'dead_lettered') {
        summary.deadLettered = Number(row.count);
      }

      return summary;
    },
    {
      processed: 0,
      retrying: 0,
      deadLettered: 0,
      deadLetterQueue: Number(deadLetterRows[0]?.count ?? 0),
    },
  );
}
