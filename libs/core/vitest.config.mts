import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: {
    include: ['src/**/*.spec.ts'],
    exclude: ['src/**/*.e2e.spec.ts', '**/node_modules/**'],
    reporters: ['verbose'],
  },
});
