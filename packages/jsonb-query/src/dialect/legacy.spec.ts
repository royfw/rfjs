import { describe, it, expect } from 'vitest';
import { legacyDialect } from './legacy';
import { ParamBuilder } from '../param-builder';
import type { RenderContext } from './base';
import type { JsonbArrayCondition } from '../types';

function run(
  field: string,
  dataType: Parameters<typeof legacyDialect.render>[2],
  operator: Parameters<typeof legacyDialect.render>[3],
  value?: unknown,
) {
  const p = new ParamBuilder();
  const where = legacyDialect.render('"data"', field, dataType, operator, value as never, p);
  return { where, values: p.values };
}

describe('legacyDialect', () => {
  it('eq string', () => {
    expect(run('name', 'string', 'eq', 'bob')).toEqual({
      where: '(("data" #>> $1) = $2)',
      values: [['name'], 'bob'],
    });
  });

  it('eq numeric casts', () => {
    expect(run('age', 'numeric', 'eq', 18)).toEqual({
      where: '(("data" #>> $1)::numeric = $2)',
      values: [['age'], 18],
    });
  });

  it('neq uses <> (not =)', () => {
    expect(run('age', 'numeric', 'neq', 18)).toEqual({
      where: '(("data" #>> $1)::numeric <> $2)',
      values: [['age'], 18],
    });
  });

  it('date eq casts to timestamptz and parameterizes the value', () => {
    expect(run('d', 'date', 'eq', '2020-01-01')).toEqual({
      where: '(("data" #>> $1)::timestamptz = $2)',
      values: [['d'], '2020-01-01'],
    });
  });

  it('boolean eq emits valid SQL (no "= is")', () => {
    expect(run('active', 'boolean', 'eq', true)).toEqual({
      where: '(("data" #>> $1)::boolean = $2)',
      values: [['active'], true],
    });
  });

  it('isnull / isnotnull', () => {
    expect(run('name', 'string', 'isnull')).toEqual({
      where: '(("data" #>> $1) is null)',
      values: [['name']],
    });
    expect(run('name', 'string', 'isnotnull')).toEqual({
      where: '(("data" #>> $1) is not null)',
      values: [['name']],
    });
  });

  it('gt / gte / lt / lte', () => {
    expect(run('age', 'numeric', 'gt', 1).where).toBe('(("data" #>> $1)::numeric > $2)');
    expect(run('age', 'numeric', 'gte', 1).where).toBe('(("data" #>> $1)::numeric >= $2)');
    expect(run('age', 'numeric', 'lt', 1).where).toBe('(("data" #>> $1)::numeric < $2)');
    expect(run('age', 'numeric', 'lte', 1).where).toBe('(("data" #>> $1)::numeric <= $2)');
  });

  it('range', () => {
    expect(run('age', 'numeric', 'range', [1, 9])).toEqual({
      where: '(("data" #>> $1)::numeric between $2 and $3)',
      values: [['age'], 1, 9],
    });
  });

  it('terms uses = ANY with a type-cast array param', () => {
    expect(run('tag', 'string', 'terms', ['a', 'b'])).toEqual({
      where: '(("data" #>> $1) = ANY($2::text[]))',
      values: [['tag'], ['a', 'b']],
    });
    expect(run('age', 'numeric', 'terms', [1, 2])).toEqual({
      where: '(("data" #>> $1)::numeric = ANY($2::numeric[]))',
      values: [['age'], [1, 2]],
    });
    expect(run('d', 'date', 'terms', ['2020-01-01', '2021-01-01'])).toEqual({
      where: '(("data" #>> $1)::timestamptz = ANY($2::timestamptz[]))',
      values: [['d'], ['2020-01-01', '2021-01-01']],
    });
  });

  it('contains / startswith / endswith match literally', () => {
    expect(run('s', 'string', 'contains', 'x')).toEqual({
      where: '(position($2 in ("data" #>> $1)) > 0)',
      values: [['s'], 'x'],
    });
    expect(run('s', 'string', 'startswith', 'x')).toEqual({
      where: '(left(("data" #>> $1), char_length($2)) = $2)',
      values: [['s'], 'x'],
    });
    expect(run('s', 'string', 'endswith', 'x')).toEqual({
      where: '(right(("data" #>> $1), char_length($2)) = $2)',
      values: [['s'], 'x'],
    });
  });

  it('nested field path becomes a multi-element text[] param', () => {
    expect(run('address.city', 'string', 'eq', 'TP').values[0]).toEqual(['address', 'city']);
  });

  it('keeps an injection payload in values, never in the SQL', () => {
    const { where, values } = run('name', 'string', 'eq', "x'; DROP TABLE t; --");
    expect(where).toBe('(("data" #>> $1) = $2)');
    expect(values[1]).toBe("x'; DROP TABLE t; --");
  });

  it('throws on an unknown operator', () => {
    expect(() => run('name', 'string', 'bogus' as never, 'x')).toThrow(/unsupported operator/i);
  });

  it('case-insensitive operators lower() both sides (literal, no LIKE)', () => {
    expect(run('name', 'string', 'ieq', 'Bob')).toEqual({
      where: '(lower(("data" #>> $1)) = lower($2))',
      values: [['name'], 'Bob'],
    });
    expect(run('name', 'string', 'ineq', 'Bob').where).toBe('(lower(("data" #>> $1)) <> lower($2))');
    expect(run('name', 'string', 'icontains', 'Bo').where).toBe(
      '(position(lower($2) in lower(("data" #>> $1))) > 0)',
    );
    expect(run('name', 'string', 'istartswith', 'Bo').where).toBe(
      '(left(lower(("data" #>> $1)), char_length(lower($2))) = lower($2))',
    );
    expect(run('name', 'string', 'iendswith', 'ob').where).toBe(
      '(right(lower(("data" #>> $1)), char_length(lower($2))) = lower($2))',
    );
  });
});

function makeCtx(
  p: ParamBuilder,
  renderGroup: RenderContext['renderGroup'] = () => {
    throw new Error('renderGroup not stubbed');
  },
): RenderContext {
  let n = 0;
  return {
    params: p,
    nextAlias: () => {
      n += 1;
      return `e${n}`;
    },
    renderGroup,
  };
}

const GUARD = (col: string, ph: string) =>
  `case when jsonb_typeof(${col} #> ${ph}) = 'array' then ${col} #> ${ph} else '[]'::jsonb end`;

describe('legacyDialect.renderArray', () => {
  function runArray(cond: Omit<JsonbArrayCondition, 'dataType'>) {
    const p = new ParamBuilder();
    const ctx = makeCtx(p);
    const where = legacyDialect.renderArray('"data"', { ...cond, dataType: 'array' }, ctx);
    return { where, values: p.values, ctx };
  }

  it('element eq uses EXISTS over jsonb_array_elements_text with a typeof guard', () => {
    expect(runArray({ field: 'tags', elementType: 'string', operator: 'eq', value: 'a' })).toMatchObject({
      where: `(exists (select 1 from jsonb_array_elements_text(${GUARD('"data"', '$1')}) as e1(v) where (e1.v = $2)))`,
      values: [['tags'], 'a'],
    });
  });

  it('element gt casts the element', () => {
    expect(runArray({ field: 'nums', elementType: 'numeric', operator: 'gt', value: 5 }).where).toBe(
      `(exists (select 1 from jsonb_array_elements_text(${GUARD('"data"', '$1')}) as e1(v) where (e1.v::numeric > $2)))`,
    );
  });

  it('element range / terms / string ops reuse the scalar operator rendering', () => {
    expect(runArray({ field: 'nums', elementType: 'numeric', operator: 'range', value: [1, 9] }).where).toContain(
      '(e1.v::numeric between $2 and $3)',
    );
    expect(runArray({ field: 'tags', elementType: 'string', operator: 'terms', value: ['a', 'b'] }).where).toContain(
      '(e1.v = ANY($2::text[]))',
    );
    expect(runArray({ field: 'tags', elementType: 'string', operator: 'startswith', value: 'x' }).where).toContain(
      '(left(e1.v, char_length($2)) = $2)',
    );
    expect(runArray({ field: 'dates', elementType: 'date', operator: 'gt', value: '2020-01-01' }).where).toContain(
      '(e1.v::timestamptz > $2)',
    );
  });

  it('containsall maps to @> with a JSON-stringified param', () => {
    expect(runArray({ field: 'tags', elementType: 'string', operator: 'containsall', value: ['a', 'b'] })).toMatchObject({
      where: '(("data" #> $1) @> $2::jsonb)',
      values: [['tags'], '["a","b"]'],
    });
  });

  it('element neq negates the existence (value not present)', () => {
    expect(runArray({ field: 'tags', elementType: 'string', operator: 'neq', value: 'a' })).toMatchObject({
      where: `(not (exists (select 1 from jsonb_array_elements_text(${GUARD('"data"', '$1')}) as e1(v) where (e1.v = $2))))`,
      values: [['tags'], 'a'],
    });
  });

  it('isnull / isnotnull test the array field itself', () => {
    expect(runArray({ field: 'tags', elementType: 'string', operator: 'isnull' })).toMatchObject({
      where: '(("data" #>> $1) is null)',
      values: [['tags']],
    });
  });

  it('isempty / isnotempty test the array length (dialect-independent)', () => {
    expect(runArray({ field: 'tags', elementType: 'string', operator: 'isempty' })).toMatchObject({
      where:
        "(case when jsonb_typeof(\"data\" #> $1) = 'array' then jsonb_array_length(\"data\" #> $1) = 0 else false end)",
      values: [['tags']],
    });
    expect(runArray({ field: 'tags', elementType: 'string', operator: 'isnotempty' }).where).toBe(
      "(case when jsonb_typeof(\"data\" #> $1) = 'array' then jsonb_array_length(\"data\" #> $1) > 0 else false end)",
    );
  });

  it('allocates unique aliases across calls sharing a context', () => {
    const p = new ParamBuilder();
    const ctx = makeCtx(p);
    const a = legacyDialect.renderArray('"data"', { field: 'x', dataType: 'array', elementType: 'string', operator: 'eq', value: 'a' }, ctx);
    const b = legacyDialect.renderArray('"data"', { field: 'y', dataType: 'array', elementType: 'string', operator: 'eq', value: 'b' }, ctx);
    expect(a).toContain('as e1(v)');
    expect(b).toContain('as e2(v)');
  });
});

describe('legacyDialect.renderElemMatch', () => {
  const cond = {
    field: 'items',
    dataType: 'array',
    elementType: 'object',
    operator: 'elemmatch',
    filters: { logic: 'and', filters: [{ field: 'sku', dataType: 'string', operator: 'eq', value: 'x' }] },
  } as const;

  it('wraps the sub-group in EXISTS over jsonb_array_elements, rendered against the alias', () => {
    const p = new ParamBuilder();
    const seen: string[] = [];
    const ctx = makeCtx(p, (_group, col) => {
      seen.push(col);
      return `<<sub:${col}>>`;
    });
    const where = legacyDialect.renderElemMatch('"data"', cond, ctx);
    expect(where).toBe(
      `(exists (select 1 from jsonb_array_elements(${GUARD('"data"', '$1')}) as e1 where <<sub:e1.value>>))`,
    );
    expect(seen).toEqual(['e1.value']);
    expect(p.values).toEqual([['items']]);
  });

  it('throws when the sub-group renders empty', () => {
    const p = new ParamBuilder();
    const ctx = makeCtx(p, () => '');
    expect(() => legacyDialect.renderElemMatch('"data"', cond, ctx)).toThrow(
      /requires a filter group with at least one condition/i,
    );
  });
});
