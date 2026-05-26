import fs from 'fs';
import path from 'path';

type BundleType = 'rollup' | 'esbuild' | 'tsdown';
type PackageKind = 'lib' | 'bin';

export type CopyPackageJsonOptions = {
  distDir?: string;
  type?: BundleType;
  kind?: PackageKind;
};

type EsbuildBuild = {
  onEnd: (cb: () => void) => void;
};

export type EsbuildPlugin = {
  name: string;
  setup: (build: EsbuildBuild) => void;
};

export type RollupPlugin = {
  name: string;
  writeBundle: () => void;
};

export type TsdownPlugin = {
  name: string;
  closeBundle: () => Promise<void>;
};

type PluginResult = EsbuildPlugin | RollupPlugin | TsdownPlugin;

/**
 * Process package.json: strip source-only fields, set dist-appropriate fields.
 */
function processPackageJson(distDir: string, kind: PackageKind, pkgName: string): void {
  const pkg: Record<string, unknown> = JSON.parse(fs.readFileSync('package.json', 'utf-8'));

  delete pkg.main;
  delete pkg.module;
  delete pkg.types;
  delete pkg.exports;
  delete pkg.devDependencies;
  delete pkg.scripts;
  delete pkg['lint-staged'];
  delete pkg.config;
  delete pkg.packageManager;

  if (kind === 'lib') {
    pkg.main = 'index.js';
    pkg.module = 'index.mjs';
    pkg.types = 'index.d.ts';
  } else {
    pkg.bin = { [pkgName]: './bin/index.js' };
    pkg.type = 'module';
  }

  const outPath: string = path.join(distDir, 'package.json');
  fs.writeFileSync(outPath, JSON.stringify(pkg, null, 2), 'utf-8');
  console.log(`\nPackage.json copied to: ${outPath}`);
}

/**
 * Unified copyPackageJsonPlugin for tsdown / esbuild / rollup.
 */
export function copyPackageJsonPlugin(
  options: CopyPackageJsonOptions = {},
): PluginResult | void {
  const distDir: string = options.distDir ?? 'dist';
  const type: BundleType = options.type ?? 'tsdown';
  const kind: PackageKind = options.kind ?? 'lib';
  const pluginName: string = `${type}-copy-package-json-plugin`;

  const run = (): void => {
    const pkgName: string = (JSON.parse(fs.readFileSync('package.json', 'utf-8')) as { name: string }).name;
    processPackageJson(distDir, kind, pkgName);
  };

  switch (type) {
    case 'rollup':
      return {
        name: pluginName,
        writeBundle: run,
      };
    case 'esbuild':
      return {
        name: pluginName,
        setup(build: EsbuildBuild): void {
          build.onEnd(run);
        },
      };
    case 'tsdown':
      return {
        name: pluginName,
        closeBundle: (): Promise<void> => Promise.resolve().then(run),
      };
    default:
      run();
      return undefined;
  }
}

/** Shortcut: tsdown + lib kind */
export function tsdownCopyPackageJsonPlugin(
  options: Omit<CopyPackageJsonOptions, 'type'> = {},
): TsdownPlugin {
  return copyPackageJsonPlugin({ ...options, type: 'tsdown' }) as TsdownPlugin;
}

/** Shortcut: esbuild + lib kind */
export function esbuildCopyPackageJsonPlugin(
  options: Omit<CopyPackageJsonOptions, 'type'> = {},
): EsbuildPlugin {
  return copyPackageJsonPlugin({ ...options, type: 'esbuild' }) as EsbuildPlugin;
}

/** Shortcut: rollup + lib kind */
export function rollupCopyPackageJsonPlugin(
  options: Omit<CopyPackageJsonOptions, 'type'> = {},
): RollupPlugin {
  return copyPackageJsonPlugin({ ...options, type: 'rollup' }) as RollupPlugin;
}
