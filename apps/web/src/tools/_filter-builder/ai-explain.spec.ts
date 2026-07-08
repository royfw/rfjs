import { describe, expect, it } from 'vitest';
import type { FieldSchema } from '@rfjs/filter-builder';

import { buildAskPrompt, buildExplainPrompt, type ExplainContext } from './ai-explain';

const SCHEMA: FieldSchema[] = [
  { path: 'age', dataType: 'numeric', kind: 'jsonb' },
  { path: 'active', dataType: 'boolean', kind: 'jsonb' },
];

const CTX: ExplainContext = {
  canonicalJson: '{"logic":"and","filters":[{"field":"age","dataType":"numeric","operator":"gt","value":30}]}',
  schema: SCHEMA,
  compiled: 'WHERE age > $1',
  engineId: 'pg-filter',
  locale: 'zh-TW',
};

describe('buildExplainPrompt', () => {
  it('system 含引擎、欄位清單、canonical、compiled、locale、純文字指示', () => {
    const p = buildExplainPrompt(CTX);
    expect(p.system).toContain('pg-filter');
    expect(p.system).toContain('age (numeric)');
    expect(p.system).toContain(CTX.canonicalJson);
    expect(p.system).toContain('WHERE age > $1');
    expect(p.system).toContain('zh-TW');
    expect(p.system.toLowerCase()).toContain('plain text');
    expect(p.user).toMatch(/explain/i);
  });

  it('compiled 為 null 時標示 (none)', () => {
    const p = buildExplainPrompt({ ...CTX, compiled: null });
    expect(p.system).toContain('(none)');
  });
});

describe('buildAskPrompt', () => {
  it('user 為問題原文,system 同 context', () => {
    const p = buildAskPrompt(CTX, '能挑出 30 歲以上的活躍使用者嗎?');
    expect(p.user).toBe('能挑出 30 歲以上的活躍使用者嗎?');
    expect(p.system).toContain(CTX.canonicalJson);
  });
});
