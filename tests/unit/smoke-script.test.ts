import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  detectComposeCommand,
  pickComposeFile,
  quotePostgresLiteral,
  replacePortBinding,
} from '../../scripts/smoke-lib';

function readPackageJson() {
  const filePath = path.join(process.cwd(), 'package.json');
  return JSON.parse(readFileSync(filePath, 'utf8')) as {
    scripts?: Record<string, string>;
  };
}

describe('smoke script wiring', () => {
  it('exposes the smoke orchestrator through package.json', () => {
    expect(readPackageJson().scripts?.smoke).toBe(
      'ts-node --project tsconfig.json scripts/smoke.ts',
    );
  });
});

describe('detectComposeCommand', () => {
  it('prefers docker-compose when it is installed', () => {
    const compose = detectComposeCommand((command) =>
      command === 'docker-compose' ? 0 : 1,
    );

    expect(compose).toEqual(['docker-compose']);
  });

  it('falls back to docker compose when the plugin is available', () => {
    const compose = detectComposeCommand((command, args) =>
      command === 'docker' && args[0] === 'compose' ? 0 : 1,
    );

    expect(compose).toEqual(['docker', 'compose']);
  });
});

describe('pickComposeFile', () => {
  it('prefers the runtime override when present', () => {
    expect(
      pickComposeFile(['docker-compose.yml', 'docker-compose.runtime.yml']),
    ).toBe('docker-compose.runtime.yml');
  });
});

describe('createRenderedComposeFilePath', () => {
  it('renders the temporary compose file next to the base compose file', async () => {
    const smokeLib = (await import('../../scripts/smoke-lib')) as {
      createRenderedComposeFilePath?: (
        baseComposeFile: string,
        suffix: string,
      ) => string;
    };

    const renderedPath = smokeLib.createRenderedComposeFilePath?.(
      '/workspace/docker-compose.runtime.yml',
      'smoke-123',
    );

    expect(renderedPath).toBeDefined();
    expect(dirname(renderedPath ?? '')).toBe('/workspace');
    expect(renderedPath).toContain('smoke-123');
  });
});

describe('waitFor', () => {
  it('retries after transient predicate errors', async () => {
    const smokeLib = (await import('../../scripts/smoke-lib')) as {
      waitFor?: (
        predicate: () => boolean | Promise<boolean>,
        label: string,
        timeoutMs?: number,
        intervalMs?: number,
      ) => Promise<void>;
    };
    let attempts = 0;

    await expect(
      smokeLib.waitFor?.(
        async () => {
          attempts += 1;
          if (attempts === 1) {
            throw new Error('fetch failed');
          }

          return true;
        },
        'transient smoke dependency',
        50,
        0,
      ),
    ).resolves.toBeUndefined();
    expect(attempts).toBe(2);
  });
});

describe('replacePortBinding', () => {
  it('replaces an existing published port binding in compose content', () => {
    const updated = replacePortBinding(
      "ports:\n  - '49092:9092'\n",
      '49092:9092',
      '61092:9092',
    );

    expect(updated).toContain("'61092:9092'");
    expect(updated).not.toContain("'49092:9092'");
  });
});

describe('quotePostgresLiteral', () => {
  it('escapes embedded quotes for psql commands', () => {
    expect(quotePostgresLiteral("smoke-'event'")).toBe("'smoke-''event'''");
  });
});
