import { describe, it, expect } from 'vitest';
import { buildJsonbQuery } from './build';
import { toNamedParams } from './named-params';
import type { JsonbFilterGroup } from './types';

const one = (f: JsonbFilterGroup['filters'][number]): JsonbFilterGroup => ({
  logic: 'and',
  filters: [f],
});

describe('toNamedParams', () => {
  it('converts positional placeholders and the values array', () => {
    const r = buildJsonbQuery('data', one({ field: 'name', dataType: 'string', operator: 'eq', value: 'bob' }));
    expect(toNamedParams(r)).toEqual({
      where: '(("data" #>> :p1) = :p2)',
      params: { p1: ['name'], p2: 'bob' },
    });
  });

  it('keeps repeated placeholder references pointing at one named param', () => {
    const r = buildJsonbQuery('data', one({ field: 's', dataType: 'string', operator: 'startswith', value: 'x' }));
    expect(toNamedParams(r)).toEqual({
      where: '(left(("data" #>> :p1), char_length(:p2)) = :p2)',
      params: { p1: ['s'], p2: 'x' },
    });
  });

  it('detects paramOffset from the SQL text', () => {
    const r = buildJsonbQuery(
      'data',
      one({ field: 'age', dataType: 'numeric', operator: 'gt', value: 18 }),
      { paramOffset: 2 },
    );
    expect(toNamedParams(r)).toEqual({
      where: '(("data" #>> :p3)::numeric > :p4)',
      params: { p3: ['age'], p4: 18 },
    });
  });

  it('converts jsonpath results (path strings are values, not SQL)', () => {
    const r = buildJsonbQuery(
      'data',
      one({ field: 'tags', dataType: 'array', elementType: 'string', operator: 'eq', value: 'a' }),
      { dialect: 'jsonpath' },
    );
    expect(toNamedParams(r)).toEqual({
      where: 'jsonb_path_exists("data", :p1::jsonpath, :p2::jsonb)',
      params: { p1: '$."tags"[*] ? (@ == $v)', p2: { v: 'a' } },
    });
  });

  it('does not rewrite $ inside quoted identifiers', () => {
    const r = buildJsonbQuery('t$1', one({ field: 'name', dataType: 'string', operator: 'eq', value: 'x' }));
    expect(toNamedParams(r).where).toBe('(("t$1" #>> :p1) = :p2)');
  });

  it('supports a custom prefix and validates it', () => {
    const r = buildJsonbQuery('data', one({ field: 'a', dataType: 'string', operator: 'eq', value: 'x' }));
    expect(toNamedParams(r, 'q').where).toBe('(("data" #>> :q1) = :q2)');
    expect(() => toNamedParams(r, '1bad')).toThrow(/prefix/i);
    expect(() => toNamedParams(r, 'p-x')).toThrow(/prefix/i);
  });

  it('passes empty results through', () => {
    expect(toNamedParams({ where: '', values: [], from: [] })).toEqual({ where: '', params: {} });
  });

  it('rejects results whose placeholders do not match the values array', () => {
    expect(() => toNamedParams({ where: '($1 = $3)', values: ['a', 'b'], from: [] })).toThrow(
      /placeholders do not match/i,
    );
    expect(() => toNamedParams({ where: '($1)', values: ['a', 'b'], from: [] })).toThrow(
      /placeholders do not match/i,
    );
  });
});
