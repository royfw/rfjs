import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    ignores: ['dist/', 'types/', '.test/', '**/*.spec.ts', '**/*.test.ts'],
  },
  {
    rules: {
      // This package is published as ESM; CommonJS globals are undefined at
      // runtime (`ReferenceError: __dirname is not defined`). Resolve paths
      // against `process.cwd()` or `import.meta.url` instead.
      'no-restricted-globals': [
        'error',
        {
          name: '__dirname',
          message:
            'CommonJS __dirname is undefined in the ESM build; use process.cwd() or import.meta.url.',
        },
        {
          name: '__filename',
          message:
            'CommonJS __filename is undefined in the ESM build; use import.meta.url.',
        },
      ],
    },
  },
);
