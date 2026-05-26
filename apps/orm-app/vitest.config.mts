import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@rfjs/orm-drizzle': path.resolve(__dirname, '../../libs/orm-drizzle/src/index.ts'),
      '@rfjs/orm-kysely': path.resolve(__dirname, '../../libs/orm-kysely/src/index.ts'),
      '@rfjs/orm-prisma': path.resolve(__dirname, '../../libs/orm-prisma/src/index.ts'),
      '@rfjs/orm-typeorm': path.resolve(__dirname, '../../libs/orm-typeorm/src/index.ts'),
    },
  },
  test: {
    // ... Specify options here.
    include: ['src/**/*.test.(ts|js)', 'src/**/*.spec.(ts|js)'],
    reporters: ['verbose', 'junit', 'html'],
    outputFile: {
      html: '.test/vitest/html/index.html',
      junit: '.test/vitest/results.xml',
    },
    coverage: {
      enabled: true,
      all: true,
      include: ['src/*'],
      reporter: [
        'cobertura',
        'text',
        process.env.VITEST_COV_PATH
          ? ['html', { subdir: `${process.env.VITEST_COV_PATH}` }]
          : 'html',
      ],
      provider: 'istanbul', // or 'v8'
      reportsDirectory: '.test/vitest/coverage',
    },
  },
});
