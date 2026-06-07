import { describe, it, expect } from 'vitest';
import { renderObjectCondition } from './object-condition';
import { ParamBuilder } from './param-builder';
import type { JsonbObjectCondition } from './types';

function run(cond: Omit<JsonbObjectCondition, 'dataType'>) {
  const p = new ParamBuilder();
  const where = renderObjectCondition('"data"', { ...cond, dataType: 'object' }, p);
  return { where, values: p.values };
}

describe('renderObjectCondition', () => {
  it('eq compares via #> against a jsonb param (structural equality)', () => {
    expect(run({ field: 'profile', operator: 'eq', value: { vip: true } })).toEqual({
      where: '(("data" #> $1) = $2::jsonb)',
      values: [['profile'], '{"vip":true}'],
    });
  });

  it('neq uses <>', () => {
    expect(run({ field: 'profile', operator: 'neq', value: { vip: true } })).toEqual({
      where: '(("data" #> $1) <> $2::jsonb)',
      values: [['profile'], '{"vip":true}'],
    });
  });

  it('contains uses @> and supports dot paths', () => {
    expect(run({ field: 'meta.flags', operator: 'contains', value: { beta: true } })).toEqual({
      where: '(("data" #> $1) @> $2::jsonb)',
      values: [['meta', 'flags'], '{"beta":true}'],
    });
  });

  it('isnull / isnotnull use the shared #>> null check', () => {
    expect(run({ field: 'profile', operator: 'isnull' })).toEqual({
      where: '(("data" #>> $1) is null)',
      values: [['profile']],
    });
    expect(run({ field: 'profile', operator: 'isnotnull' })).toEqual({
      where: '(("data" #>> $1) is not null)',
      values: [['profile']],
    });
  });

  it('rejects non-object values', () => {
    expect(() => run({ field: 'p', operator: 'eq', value: [1] as never })).toThrow(
      /requires a plain object value/i,
    );
  });

  it('keeps hostile values in params, never in SQL', () => {
    const { where, values } = run({
      field: 'p', operator: 'eq', value: { name: "x'; DROP TABLE t; --" },
    });
    expect(where).toBe('(("data" #> $1) = $2::jsonb)');
    expect(values[1]).toBe('{"name":"x\'; DROP TABLE t; --"}');
  });
});
