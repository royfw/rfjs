/**
 * Default lint-staged configuration for rfjs templates.
 *
 * Runs related tests, formats with Prettier, and lints with ESLint.
 */
export const defaultLintStagedConfig: Record<string, string[]> = {
  '*.ts': [
    'pnpm exec vitest related --run',
    'pnpm exec prettier --write',
    'pnpm exec eslint --fix',
  ],
};

/**
 * Lint-staged config without test runner (for templates that don't use Vitest).
 */
export const defaultLintStagedConfigNoTest: Record<string, string[]> = {
  '*.ts': [
    'pnpm exec prettier --write',
    'pnpm exec eslint --fix',
  ],
};
