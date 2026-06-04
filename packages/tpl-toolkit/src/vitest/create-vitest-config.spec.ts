import { describe, it, expect } from 'vitest';
import path from 'path';
import { createVitestConfig } from './vitest.config.factory';

describe('createVitestConfig', () => {
  it('resolves the @ alias against the consumer cwd, not the toolkit install dir', () => {
    const cfg = createVitestConfig();
    const alias = (cfg.resolve as { alias: Record<string, string> }).alias['@'];
    expect(alias).toBe(path.resolve(process.cwd(), 'src'));
  });

  it('produces an absolute @ alias under the current working directory', () => {
    const cfg = createVitestConfig();
    const alias = (cfg.resolve as { alias: Record<string, string> }).alias['@'];
    expect(path.isAbsolute(alias)).toBe(true);
    expect(alias.startsWith(process.cwd())).toBe(true);
  });

  it('applies caller overrides on top of the defaults', () => {
    const cfg = createVitestConfig({ root: '/tmp/example' });
    expect(cfg.root).toBe('/tmp/example');
    expect(cfg.resolve).toBeDefined();
  });
});
