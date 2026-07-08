import { describe, expect, it } from 'vitest';
import type { FieldSchema } from '@rfjs/filter-builder';

import { AI_SAMPLE_LIMIT, buildAskPrompt, buildExplainPrompt, sampleSection, type ExplainContext } from './ai-explain';

const SCHEMA: FieldSchema[] = [
  { path: 'age', dataType: 'numeric', include: true, kind: 'jsonb' },
  { path: 'active', dataType: 'boolean', include: true, kind: 'jsonb' },
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

describe('sampleRows context', () => {
  it('帶入樣本:嵌入前 N 筆與總筆數', () => {
    const rows = [{ age: 42, active: true }, { age: 18, active: false }];
    const p = buildAskPrompt({ ...CTX, sampleRows: rows }, '有幾筆活躍?');
    expect(p.system).toContain('Sample data (first 2 of 2 rows):');
    expect(p.system).toContain('"age":42');
  });

  it(`超過 AI_SAMPLE_LIMIT(${AI_SAMPLE_LIMIT})只帶前 ${AI_SAMPLE_LIMIT} 筆`, () => {
    const rows = Array.from({ length: AI_SAMPLE_LIMIT + 4 }, (_, i) => ({ n: i }));
    const [head, json] = sampleSection(rows);
    expect(head).toBe(`Sample data (first ${AI_SAMPLE_LIMIT} of ${AI_SAMPLE_LIMIT + 4} rows):`);
    expect(JSON.parse(json as string)).toHaveLength(AI_SAMPLE_LIMIT);
  });

  it('無樣本 / 空樣本:不加段落', () => {
    expect(sampleSection(undefined)).toEqual([]);
    expect(sampleSection([])).toEqual([]);
    const p = buildExplainPrompt(CTX);
    expect(p.system).not.toContain('Sample data');
  });
});
