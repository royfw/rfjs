import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    // ... Specify options here.
    include: ['src/**/*.test.(ts|js)', 'src/**/*.spec.(ts|js)'],
    reporters: ['verbose', 'junit'],
    outputFile: {
      junit: '.test/vitest/results.xml',
    },
    coverage: {
      enabled: false,
    },
  },
});
