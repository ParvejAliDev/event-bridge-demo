import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import net from 'node:net';

import {
  createRenderedComposeFilePath,
  detectComposeCommand,
  detectComposeFile,
  quotePostgresLiteral,
  replacePortBinding,
  waitFor,
} from './smoke-lib';

type RunResult = {
  status: number;
  stdout: string;
  stderr: string;
};

type DeadLetterRecord = {
  eventId: string;
  reason: string;
  createdAt: string;
};

async function main() {
  const composeCommand = detectComposeCommand();
  const baseComposeFile = detectComposeFile();
  const projectName = `event-bridge-smoke-${Date.now()}`;
  const renderedComposeFile = createRenderedComposeFilePath(
    baseComposeFile,
    `smoke-${process.pid}-${Date.now()}`,
  );
  const [appPort, postgresPort, redisPort, kafkaPort] = await Promise.all([
    findFreePort(),
    findFreePort(),
    findFreePort(),
    findFreePort(),
  ]);
  const baseUrl = `http://127.0.0.1:${appPort}`;
  const successEventId = `smoke-success-${Date.now()}`;
  const replayEventId = `smoke-replay-${Date.now()}`;
  const composeTemplate = readFileSync(baseComposeFile, 'utf8');
  const renderedCompose = replacePortBinding(
    replacePortBinding(
      replacePortBinding(
        replacePortBinding(composeTemplate, '4000:4000', `${appPort}:4000`),
        '49092:9092',
        `${kafkaPort}:9092`,
      ),
      '45432:5432',
      `${postgresPort}:5432`,
    ),
    '46379:6379',
    `${redisPort}:6379`,
  );

  writeFileSync(renderedComposeFile, renderedCompose, 'utf8');

  try {
    runCompose(composeCommand, projectName, renderedComposeFile, [
      'up',
      '--build',
      '-d',
    ]);

    await waitFor(
      async () => {
        const response = await fetch(`${baseUrl}/ready`);
        return response.ok;
      },
      'event bridge ready endpoint',
      120_000,
    );

    const health = await fetchJson<{ status: string }>(`${baseUrl}/health`);
    assert(
      health.status === 'ok',
      `Expected /health to return ok, got ${health.status}`,
    );

    const publishResponse = await fetchJson<{
      accepted: boolean;
      status: string;
    }>(`${baseUrl}/events/ingest`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        eventId: successEventId,
        orderId: 'ord-smoke-success',
        type: 'order.created',
        occurredAt: new Date().toISOString(),
        payload: {},
      }),
    });
    assert(
      publishResponse.accepted && publishResponse.status === 'published',
      `Expected Kafka ingest to publish the smoke event, got ${JSON.stringify(publishResponse)}`,
    );

    await waitFor(
      async () => {
        const status = selectEventStatus(
          composeCommand,
          projectName,
          renderedComposeFile,
          successEventId,
        );
        return status === 'processed';
      },
      'processed smoke Kafka event',
      120_000,
    );

    const deadLetterResponse = await fetchJson<{
      accepted: boolean;
      status: string;
    }>(`${baseUrl}/events/ingest`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        eventId: replayEventId,
        orderId: 'ord-smoke-replay',
        type: 'order.updated',
        occurredAt: new Date().toISOString(),
        payload: {
          failuresBeforeSuccess: 4,
        },
      }),
    });
    assert(
      deadLetterResponse.accepted && deadLetterResponse.status === 'published',
      `Expected retry smoke event to publish, got ${JSON.stringify(deadLetterResponse)}`,
    );

    await waitFor(
      async () => {
        const records = await fetchJson<DeadLetterRecord[]>(
          `${baseUrl}/events/dead-letter`,
        );
        return records.some((record) => record.eventId === replayEventId);
      },
      'dead-letter visibility for replay smoke event',
      120_000,
    );

    const replayResponse = await fetchJson<{
      replayed: boolean;
      outcome: string;
    }>(`${baseUrl}/events/replay/${replayEventId}`, {
      method: 'POST',
    });
    assert(
      replayResponse.replayed && replayResponse.outcome === 'processed',
      `Expected replay to succeed, got ${JSON.stringify(replayResponse)}`,
    );

    await waitFor(
      async () => {
        const status = selectEventStatus(
          composeCommand,
          projectName,
          renderedComposeFile,
          replayEventId,
        );
        return status === 'processed';
      },
      'processed replay smoke event',
      120_000,
    );

    await waitFor(
      async () => {
        const records = await fetchJson<DeadLetterRecord[]>(
          `${baseUrl}/events/dead-letter`,
        );
        return !records.some((record) => record.eventId === replayEventId);
      },
      'dead-letter removal after replay',
      30_000,
    );

    console.log(`Event Bridge smoke passed on ${baseUrl}`);
  } finally {
    try {
      runCompose(composeCommand, projectName, renderedComposeFile, [
        'down',
        '-v',
        '--remove-orphans',
      ]);
    } finally {
      rmSync(renderedComposeFile, { force: true });
    }
  }
}

function selectEventStatus(
  composeCommand: string[],
  projectName: string,
  composeFile: string,
  eventId: string,
) {
  return runComposeCapture(composeCommand, projectName, composeFile, [
    'exec',
    '-T',
    'postgres',
    'psql',
    '-U',
    'events_app',
    '-d',
    'order_events',
    '-At',
    '-c',
    `select coalesce((select status from processed_events where event_id = ${quotePostgresLiteral(
      eventId,
    )} limit 1), '');`,
  ]).stdout.trim();
}

function runCompose(
  composeCommand: string[],
  projectName: string,
  composeFile: string,
  args: string[],
) {
  const command = composeCommand[0];
  const commandArgs = [
    ...composeCommand.slice(1),
    '-p',
    projectName,
    '-f',
    composeFile,
    ...args,
  ];
  const result = spawnSync(command, commandArgs, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    throw new Error(
      `Compose command failed: ${command} ${commandArgs.join(' ')}`,
    );
  }
}

function runComposeCapture(
  composeCommand: string[],
  projectName: string,
  composeFile: string,
  args: string[],
): RunResult {
  const command = composeCommand[0];
  const commandArgs = [
    ...composeCommand.slice(1),
    '-p',
    projectName,
    '-f',
    composeFile,
    ...args,
  ];
  const result = spawnSync(command, commandArgs, {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error(
      `Compose command failed: ${command} ${commandArgs.join(' ')}\n${result.stderr}`,
    );
  }

  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

async function fetchJson<T>(
  input: string,
  init?: Parameters<typeof fetch>[1],
): Promise<T> {
  const response = await fetch(input, init);
  assert(response.ok, `Request failed for ${input} with ${response.status}`);
  return response.json() as Promise<T>;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Unable to determine a free port.'));
        return;
      }

      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(port);
      });
    });
    server.on('error', reject);
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
