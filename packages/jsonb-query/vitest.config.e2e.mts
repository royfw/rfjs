import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.e2e.test.(ts|js)', 'test/**/*.e2e.spec.(ts|js)'],
    reporters: ['verbose'],
    // Suites self-skip when PG_E2E_URLS is not set, so this config is safe to
    // run anywhere; real runs need the docker instances described in
    // test/jsonb-query.e2e.spec.ts.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
