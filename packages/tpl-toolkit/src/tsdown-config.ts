import fs from 'fs';
import path from 'path';
import type { UserConfig } from 'tsdown';
import {
  copyFilesPlugin,
  tsdownDevNodemonPlugin,
  tsdownCopyPackageJsonPlugin,
} from './plugins';

export type TsdownConfigType = 'app' | 'lib' | 'bin' | 'orm' | 'bullmq';

export type TsdownConfigOptions = {
  type: TsdownConfigType;
  /** Override any tsdown UserConfig fields */
  overrides?: Partial<UserConfig>;
};

/**
 * Read package.json and extract dependency names for externalization.
 */
function getExternalDeps(): string[] {
  const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8')) as Record<string, unknown>;
  const deps = pkg.dependencies ? Object.keys(pkg.dependencies as Record<string, string>) : [];
  const peerDeps = pkg.peerDependencies ? Object.keys(pkg.peerDependencies as Record<string, string>) : [];
  return [...deps, ...peerDeps];
}

/**
 * Read copyFiles.json if it exists, returns empty array otherwise.
 */
function getCopyFiles(): string[] {
  try {
    return JSON.parse(fs.readFileSync('./copyFiles.json', 'utf-8')) as string[];
  } catch {
    return [];
  }
}

/**
 * Create a tsdown build config for rfjs templates.
 *
 * @param type - Template type: 'app' | 'lib' | 'bin' | 'orm' | 'bullmq'
 * @param overrides - Optional UserConfig overrides (merged on top of defaults)
 *
 * @example
 *   // App template
 *   export default createTsdownConfig('app');
 *
 * @example
 *   // ORM template with custom copyFiles
 *   export default createTsdownConfig('orm', {
 *     plugins: [
 *       tsdownCopyPackageJsonPlugin(),
 *       copyFilesPlugin({ files: ['drizzle'] }),
 *     ],
 *   });
 */
export function createTsdownConfig(
  type: TsdownConfigType,
  overrides: Partial<UserConfig> = {},
): UserConfig {
  const externalDeps = getExternalDeps();
  const copyFiles = getCopyFiles();

  const base: UserConfig = {
    outDir: 'dist',
    external: externalDeps,
    tsconfig: 'tsconfig.build.json',
    treeshake: true,
    platform: 'node',
    fixedExtension: false,
    target: 'es2023',
    sourcemap: true,
    clean: true,
  };

  const presets: Record<TsdownConfigType, UserConfig> = {
    app: {
      ...base,
      entry: 'src/main.ts',
      format: ['cjs'],
      plugins: [
        copyFilesPlugin({ distDir: 'dist', files: copyFiles }),
        tsdownDevNodemonPlugin(),
      ],
    },
    bullmq: {
      ...base,
      entry: 'src/main.ts',
      format: ['cjs'],
      plugins: [
        copyFilesPlugin({ distDir: 'dist', files: copyFiles }),
        tsdownDevNodemonPlugin(),
      ],
    },
    lib: {
      ...base,
      entry: 'src/index.ts',
      format: ['esm', 'cjs'],
      platform: 'neutral',
      dts: { oxc: true },
      plugins: [tsdownCopyPackageJsonPlugin({ distDir: 'dist', kind: 'lib' })],
    },
    bin: {
      ...base,
      entry: 'src/index.ts',
      outDir: path.join('dist', 'bin'),
      format: ['esm'],
      dts: false,
      plugins: [
        tsdownCopyPackageJsonPlugin({ distDir: 'dist', kind: 'bin' }),
        copyFilesPlugin({ distDir: 'dist', files: copyFiles }),
      ],
    },
    orm: {
      ...base,
      entry: 'src/index.ts',
      format: ['esm', 'cjs'],
      platform: 'node',
      dts: { oxc: true },
      plugins: [
        tsdownCopyPackageJsonPlugin({ distDir: 'dist', kind: 'lib' }),
        ...(copyFiles.length ? [copyFilesPlugin({ distDir: 'dist', files: copyFiles })] : []),
      ],
    },
  };

  const preset = presets[type];
  return { ...preset, ...overrides };
}
