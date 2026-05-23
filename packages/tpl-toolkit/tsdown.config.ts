import { defineConfig } from 'tsdown';
import fs from 'fs';

const pkg: Record<string, unknown> =
  JSON.parse(fs.readFileSync('./package.json', 'utf-8')) ?? {};
const dependencies: string[] = Object.keys(pkg.dependencies || {});
const peerDependencies: string[] = Object.keys(pkg.peerDependencies || {});
const externalDeps = [...dependencies, ...peerDependencies];

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/vitest/index.ts',
    'src/lint-staged/index.ts',
  ],
  outDir: 'dist',
  external: externalDeps,
  tsconfig: 'tsconfig.build.json',
  format: ['esm', 'cjs'],
  treeshake: true,
  platform: 'node',
  fixedExtension: false,
  target: 'es2022',
  sourcemap: true,
  clean: true,
  dts: {
    oxc: true,
  },
});
