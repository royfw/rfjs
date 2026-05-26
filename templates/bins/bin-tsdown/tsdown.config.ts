import { defineConfig, type OutExtensionContext } from 'tsdown';
import { createTsdownConfig } from '@rfjs/tpl-toolkit/tsdown-config';

export default defineConfig(
  createTsdownConfig('bin', {
    outExtensions: (_ctx: OutExtensionContext) => ({ js: 'js' }),
  }),
);
