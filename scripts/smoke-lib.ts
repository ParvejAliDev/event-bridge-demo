import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

export type ComposeCommand = string[];

export function detectComposeCommand(
  runCheck: (command: string, args: string[]) => number = (command, args) =>
    spawnSync(command, args, { stdio: 'ignore' }).status ?? 1,
): ComposeCommand {
  if (runCheck('docker-compose', ['version']) === 0) {
    return ['docker-compose'];
  }

  if (runCheck('docker', ['compose', 'version']) === 0) {
    return ['docker', 'compose'];
  }

  throw new Error('Neither docker-compose nor docker compose is available.');
}

export function pickComposeFile(files: string[]): string {
  if (files.includes('docker-compose.runtime.yml')) {
    return 'docker-compose.runtime.yml';
  }

  if (files.includes('docker-compose.yml')) {
    return 'docker-compose.yml';
  }

  throw new Error('No Docker Compose file was found.');
}

export function detectComposeFile(
  candidates = ['docker-compose.runtime.yml', 'docker-compose.yml'],
): string {
  const existing = candidates.filter((candidate) => existsSync(candidate));
  return pickComposeFile(existing);
}

export function createRenderedComposeFilePath(
  baseComposeFile: string,
  suffix: string,
): string {
  const parsedPath = path.parse(path.resolve(baseComposeFile));
  return path.join(
    parsedPath.dir,
    `${parsedPath.name}.${suffix}${parsedPath.ext || '.yml'}`,
  );
}

export function replacePortBinding(
  composeText: string,
  existingBinding: string,
  nextBinding: string,
): string {
  const updated = composeText.replace(
    `'${existingBinding}'`,
    `'${nextBinding}'`,
  );

  if (updated === composeText) {
    throw new Error(`Unable to replace port binding ${existingBinding}.`);
  }

  return updated;
}

export async function waitFor(
  predicate: () => boolean | Promise<boolean>,
  label: string,
  timeoutMs = 90_000,
  intervalMs = 1_000,
) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      if (await predicate()) {
        return;
      }
    } catch {
      // Retry through transient startup errors until the timeout expires.
      void 0;
    }

    await sleep(intervalMs);
  }

  throw new Error(`Timed out waiting for ${label}.`);
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function quotePostgresLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}
