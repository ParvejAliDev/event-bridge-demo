import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { configureApp, resolveStaticAssetsPath } from '../../src/bootstrap';

describe('resolveStaticAssetsPath', () => {
  it('prefers a public directory inside the current module directory when present', () => {
    const moduleDir = '/workspace/event-bridge-demo/src';

    const path = resolveStaticAssetsPath(
      moduleDir,
      (candidate) => candidate === join(moduleDir, 'public'),
    );

    expect(path).toBe(join(moduleDir, 'public'));
  });

  it('falls back to the parent public directory for built dist/src runtime layout', () => {
    const moduleDir = '/workspace/event-bridge-demo/dist/src';

    const path = resolveStaticAssetsPath(
      moduleDir,
      (candidate) =>
        candidate === join('/workspace/event-bridge-demo/dist', 'public'),
    );

    expect(path).toBe(join('/workspace/event-bridge-demo/dist', 'public'));
  });
});

describe('configureApp', () => {
  it('mounts the resolved static-assets path and enables shutdown hooks', () => {
    const app = {
      enableShutdownHooks: vi.fn(),
      useStaticAssets: vi.fn(),
    };
    const moduleDir = '/workspace/event-bridge-demo/dist/src';

    configureApp(app as never, {
      moduleDir,
      pathExists: (candidate) =>
        candidate === join('/workspace/event-bridge-demo/dist', 'public'),
    });

    expect(app.useStaticAssets).toHaveBeenCalledOnce();
    expect(app.useStaticAssets).toHaveBeenCalledWith(
      join('/workspace/event-bridge-demo/dist', 'public'),
    );
    expect(app.enableShutdownHooks).toHaveBeenCalledOnce();
  });
});
