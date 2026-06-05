import path from 'path';
import type { UserConfig } from 'vitest/config';

/**
 * Create a standard Vitest config for rfjs templates.
 *
 * This matches the default vitest.config.mts used across all templates.
 *
 * The `@` alias is resolved against the consumer's working directory
 * (`process.cwd()`), i.e. the template project that runs Vitest — not this
 * toolkit's install location. Using `__dirname` here would both point at
 * `node_modules/@rfjs/tpl-toolkit/...` and throw `ReferenceError: __dirname is
 * not defined` in the ESM build.
 */
export function createVitestConfig(overrides?: Partial<UserConfig>): UserConfig {
  return {
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), './src'),
      },
    },
    test: {
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
        provider: 'istanbul' as const,
        reportsDirectory: '.test/vitest/coverage',
      },
    },
    ...overrides,
  };
}
