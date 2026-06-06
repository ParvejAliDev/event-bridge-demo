import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

type BootstrapApp = {
  enableShutdownHooks(): void;
  useStaticAssets(path: string): void;
};

type BootstrapOptions = {
  moduleDir?: string;
  pathExists?: (path: string) => boolean;
};

export function resolveStaticAssetsPath(
  moduleDir: string,
  pathExists: (path: string) => boolean = existsSync,
) {
  const localPublicDir = join(moduleDir, 'public');

  if (pathExists(localPublicDir)) {
    return localPublicDir;
  }

  const parentPublicDir = join(dirname(moduleDir), 'public');

  if (pathExists(parentPublicDir)) {
    return parentPublicDir;
  }

  return localPublicDir;
}

export function configureApp(
  app: BootstrapApp,
  options: BootstrapOptions = {},
) {
  app.useStaticAssets(
    resolveStaticAssetsPath(options.moduleDir ?? __dirname, options.pathExists),
  );
  app.enableShutdownHooks();
}
