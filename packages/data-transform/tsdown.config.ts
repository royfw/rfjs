import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: ['esm', 'cjs'],
  tsconfig: 'tsconfig.build.json',
  target: 'es2023',
  platform: 'neutral',
  treeshake: true,
  sourcemap: true,
  clean: true,
  dts: true,
});
