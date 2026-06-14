/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { defineConfig } from 'tsdown';
import { tsdownCopyPackageJsonPlugin } from './scripts/copyPackageJsonPlugin';
import fs from 'fs';

// 讀取 root package.json，標記 external
const pkg: Record<string, unknown> =
  JSON.parse(fs.readFileSync('./package.json', 'utf-8')) ?? {};
const dependencies: string[] = Object.keys(pkg.dependencies || {});
const peerDependencies: string[] = Object.keys(pkg.peerDependencies || {});
const externalDeps = [...dependencies, ...peerDependencies];

export default defineConfig({
  entry: 'src/index.ts',
  outDir: 'dist',
  external: externalDeps,
  tsconfig: 'tsconfig.build.json',
  format: ['esm', 'cjs'],
  treeshake: true,
  platform: 'node',
  fixedExtension: false,
  target: 'es2023',
  sourcemap: true,
  clean: true,
  dts: {
    oxc: false,
  },
  plugins: [
    tsdownCopyPackageJsonPlugin({
      distDir: 'dist',
    }),
  ],
});
