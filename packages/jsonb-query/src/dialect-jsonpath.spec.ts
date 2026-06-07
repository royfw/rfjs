import { describe, it, expect } from 'vitest';
import { jsonpathDialect } from './dialect-jsonpath';
import { ParamBuilder } from './param-builder';
import type { RenderContext } from './dialect';
import type {
  JsonbArrayCondition,
  JsonbElemMatchCondition,
  JsonbFilterGroup,
} from './types';

function makeCtx(p: ParamBuilder): RenderContext {
  let n = 0;
  return {
    params: p,
    nextAlias: () => {
      n += 1;
      return `e${n}`;
    },
    renderGroup: () => {
      throw new Error('renderGroup not used by jsonpath dialect');
    },
  };
}

function run(
  field: string,
  dataType: Parameters<typeof jsonpathDialect.render>[2],
  operator: Parameters<typeof jsonpathDialect.render>[3],
  value?: unknown,
) {
  const p = new ParamBuilder();
  const where = jsonpathDialect.render('"data"', field, dataType, operator, value as never, p);
  return { where, values: p.values };
}

describe('jsonpathDialect', () => {
  it('eq string uses jsonb_path_exists with a vars object', () => {
    expect(run('name', 'string', 'eq', 'bob')).toEqual({
      where: 'jsonb_path_exists("data", $1::jsonpath, $2::jsonb)',
      values: ['$."name" ? (@ == $v)', { v: 'bob' }],
    });
  });

  it('nested field escapes each member', () => {
    expect(run('address.city', 'string', 'eq', 'TP').values[0]).toBe(
      '$."address"."city" ? (@ == $v)',
    );
  });

  it('neq', () => {
    expect(run('name', 'string', 'neq', 'bob').values[0]).toBe('$."name" ? (@ != $v)');
  });

  it('date eq uses .datetime() on both sides', () => {
    expect(run('d', 'date', 'eq', '2020-01-01').values[0]).toBe(
      '$."d" ? (@.datetime() == $v.datetime())',
    );
  });

  it('comparisons', () => {
    expect(run('age', 'numeric', 'gt', 1).values[0]).toBe('$."age" ? (@ > $v)');
    expect(run('age', 'numeric', 'lte', 1).values[0]).toBe('$."age" ? (@ <= $v)');
    expect(run('age', 'numeric', 'gte', 1).values[0]).toBe('$."age" ? (@ >= $v)');
    expect(run('age', 'numeric', 'lt', 1).values[0]).toBe('$."age" ? (@ < $v)');
  });

  it('range', () => {
    expect(run('age', 'numeric', 'range', [1, 9])).toEqual({
      where: 'jsonb_path_exists("data", $1::jsonpath, $2::jsonb)',
      values: ['$."age" ? (@ >= $lo && @ <= $hi)', { lo: 1, hi: 9 }],
    });
  });

  it('terms OR-expands with indexed vars', () => {
    expect(run('tag', 'string', 'terms', ['a', 'b'])).toEqual({
      where: 'jsonb_path_exists("data", $1::jsonpath, $2::jsonb)',
      values: ['$."tag" ? (@ == $v0 || @ == $v1)', { v0: 'a', v1: 'b' }],
    });
  });

  it('startswith uses the native predicate with a var', () => {
    expect(run('s', 'string', 'startswith', 'x')).toEqual({
      where: 'jsonb_path_exists("data", $1::jsonpath, $2::jsonb)',
      values: ['$."s" ? (@ starts with $v)', { v: 'x' }],
    });
  });

  it('contains embeds a regex-escaped literal (no vars)', () => {
    expect(run('s', 'string', 'contains', 'a.b')).toEqual({
      where: 'jsonb_path_exists("data", $1::jsonpath)',
      values: ['$."s" ? (@ like_regex "a\\\\.b")'],
    });
  });

  it('endswith anchors the regex literal', () => {
    expect(run('s', 'string', 'endswith', 'x').values[0]).toBe(
      '$."s" ? (@ like_regex "x$")',
    );
  });

  it('isnull / isnotnull fall back to the dialect-independent null check', () => {
    expect(run('name', 'string', 'isnull')).toEqual({
      where: '(("data" #>> $1) is null)',
      values: [['name']],
    });
    expect(run('name', 'string', 'isnotnull')).toEqual({
      where: '(("data" #>> $1) is not null)',
      values: [['name']],
    });
  });

  it('throws on an unknown operator', () => {
    expect(() => run('name', 'string', 'bogus' as never, 'x')).toThrow(/unsupported operator/i);
  });
});

describe('jsonpathDialect.renderArray', () => {
  function runArray(cond: Omit<JsonbArrayCondition, 'dataType'>) {
    const p = new ParamBuilder();
    const where = jsonpathDialect.renderArray('"data"', { ...cond, dataType: 'array' }, makeCtx(p));
    return { where, values: p.values };
  }

  it('element eq filters over [*] with phase-1 var naming', () => {
    expect(runArray({ field: 'tags', elementType: 'string', operator: 'eq', value: 'a' })).toEqual({
      where: 'jsonb_path_exists("data", $1::jsonpath, $2::jsonb)',
      values: ['$."tags"[*] ? (@ == $v)', { v: 'a' }],
    });
  });

  it('element range / terms / date / contains', () => {
    expect(runArray({ field: 'nums', elementType: 'numeric', operator: 'range', value: [1, 9] }).values[0]).toBe(
      '$."nums"[*] ? (@ >= $lo && @ <= $hi)',
    );
    expect(runArray({ field: 'tags', elementType: 'string', operator: 'terms', value: ['a', 'b'] }).values[0]).toBe(
      '$."tags"[*] ? (@ == $v0 || @ == $v1)',
    );
    expect(runArray({ field: 'dates', elementType: 'date', operator: 'eq', value: '2020-01-01' }).values[0]).toBe(
      '$."dates"[*] ? (@.datetime() == $v.datetime())',
    );
    // contains embeds an escaped regex literal and emits the 2-arg form
    expect(runArray({ field: 'tags', elementType: 'string', operator: 'contains', value: 'a.b' })).toEqual({
      where: 'jsonb_path_exists("data", $1::jsonpath)',
      values: ['$."tags"[*] ? (@ like_regex "a\\\\.b")'],
    });
  });

  it('containsall falls back to @> (identical to legacy)', () => {
    expect(runArray({ field: 'tags', elementType: 'string', operator: 'containsall', value: ['a', 'b'] })).toEqual({
      where: '(("data" #> $1) @> $2::jsonb)',
      values: [['tags'], '["a","b"]'],
    });
  });

  it('isnull / isnotnull use the dialect-independent null check', () => {
    expect(runArray({ field: 'tags', elementType: 'string', operator: 'isnull' })).toEqual({
      where: '(("data" #>> $1) is null)',
      values: [['tags']],
    });
  });
});

describe('jsonpathDialect.renderElemMatch', () => {
  function runElem(field: string, filters: JsonbFilterGroup) {
    const p = new ParamBuilder();
    const cond: JsonbElemMatchCondition = {
      field, dataType: 'array', elementType: 'object', operator: 'elemmatch', filters,
    };
    const where = jsonpathDialect.renderElemMatch('"data"', cond, makeCtx(p));
    return { where, values: p.values };
  }

  it('merges all sub-conditions into one path with sequential vars', () => {
    expect(
      runElem('items', {
        logic: 'and',
        filters: [
          { field: 'sku', dataType: 'string', operator: 'eq', value: 'x' },
          { field: 'qty', dataType: 'numeric', operator: 'gt', value: 1 },
        ],
      }),
    ).toEqual({
      where: 'jsonb_path_exists("data", $1::jsonpath, $2::jsonb)',
      values: ['$."items"[*] ? (@."sku" == $v0 && @."qty" > $v1)', { v0: 'x', v1: 1 }],
    });
  });

  it('wraps nested or-groups and compound predicates in parens', () => {
    expect(
      runElem('items', {
        logic: 'and',
        filters: [
          { field: 'sku', dataType: 'string', operator: 'eq', value: 'x' },
          {
            logic: 'or',
            filters: [
              { field: 'qty', dataType: 'numeric', operator: 'range', value: [1, 9] },
              { field: 'tag', dataType: 'string', operator: 'terms', value: ['a', 'b'] },
            ],
          },
        ],
      }).values[0],
    ).toBe(
      '$."items"[*] ? (@."sku" == $v0 && ((@."qty" >= $v1 && @."qty" <= $v2) || (@."tag" == $v3 || @."tag" == $v4)))',
    );
  });

  it('supports dotted sub-fields, datetime, startswith and null checks', () => {
    expect(
      runElem('items', {
        logic: 'and',
        filters: [
          { field: 'detail.x', dataType: 'numeric', operator: 'eq', value: 1 },
          { field: 'd', dataType: 'date', operator: 'gte', value: '2020-01-01' },
          { field: 's', dataType: 'string', operator: 'startswith', value: 'x' },
          { field: 'n', dataType: 'string', operator: 'isnull' },
          { field: 'm', dataType: 'string', operator: 'isnotnull' },
        ],
      }).values[0],
    ).toBe(
      '$."items"[*] ? (@."detail"."x" == $v0 && @."d".datetime() >= $v1.datetime() && @."s" starts with $v2 && (!exists (@."n") || @."n" == null) && (exists (@."m") && @."m" != null))',
    );
  });

  it('renders nested elemmatch via exists()', () => {
    expect(
      runElem('orders', {
        logic: 'and',
        filters: [
          { field: 'status', dataType: 'string', operator: 'eq', value: 'open' },
          {
            field: 'lines', dataType: 'array', elementType: 'object', operator: 'elemmatch',
            filters: { logic: 'and', filters: [{ field: 'sku', dataType: 'string', operator: 'eq', value: 'x' }] },
          },
        ],
      }).values[0],
    ).toBe('$."orders"[*] ? (@."status" == $v0 && exists (@."lines"[*] ? (@."sku" == $v1)))');
  });

  it('emits the 2-arg form when no vars are used', () => {
    expect(
      runElem('items', {
        logic: 'and',
        filters: [{ field: 's', dataType: 'string', operator: 'contains', value: 'x' }],
      }),
    ).toEqual({
      where: 'jsonb_path_exists("data", $1::jsonpath)',
      values: ['$."items"[*] ? (@."s" like_regex "x")'],
    });
  });

  it('escapes hostile member names into the path parameter', () => {
    expect(
      runElem('items', {
        logic: 'and',
        filters: [{ field: 'a"b', dataType: 'string', operator: 'eq', value: 'x' }],
      }).values[0],
    ).toBe('$."items"[*] ? (@."a\\"b" == $v0)');
  });

  it('rejects object / scalar-array conditions inside elemmatch', () => {
    expect(() =>
      runElem('items', {
        logic: 'and',
        filters: [{ field: 'p', dataType: 'object', operator: 'eq', value: {} }],
      }),
    ).toThrow(/not supported inside elemmatch/i);
    expect(() =>
      runElem('items', {
        logic: 'and',
        filters: [{ field: 't', dataType: 'array', elementType: 'string', operator: 'eq', value: 'x' }],
      }),
    ).toThrow(/not supported inside elemmatch/i);
  });

  it('throws when the group renders empty', () => {
    expect(() =>
      runElem('items', { logic: 'and', filters: [{ logic: 'or', filters: [] }] }),
    ).toThrow(/requires a filter group with at least one condition/i);
  });
});

describe('jsonpathDialect.renderElemMatch — nor/not groups', () => {
  function runElem2(field: string, filters: JsonbFilterGroup) {
    const p = new ParamBuilder();
    const cond: JsonbElemMatchCondition = {
      field, dataType: 'array', elementType: 'object', operator: 'elemmatch', filters,
    };
    const where = jsonpathDialect.renderElemMatch('"data"', cond, makeCtx(p));
    return { where, values: p.values };
  }

  it('negates a top-level nor group with !(… || …)', () => {
    expect(
      runElem2('items', {
        logic: 'nor',
        filters: [
          { field: 'a', dataType: 'numeric', operator: 'eq', value: 1 },
          { field: 'b', dataType: 'numeric', operator: 'eq', value: 2 },
        ],
      }).values[0],
    ).toBe('$."items"[*] ? (!(@."a" == $v0 || @."b" == $v1))');
  });

  it('negates a nested not group with !(…) and wraps it in the conjunction', () => {
    expect(
      runElem2('items', {
        logic: 'and',
        filters: [
          { field: 'sku', dataType: 'string', operator: 'eq', value: 'x' },
          {
            logic: 'not',
            filters: [{ field: 'qty', dataType: 'numeric', operator: 'gt', value: 5 }],
          },
        ],
      }).values[0],
    ).toBe('$."items"[*] ? (@."sku" == $v0 && (!(@."qty" > $v1)))');
  });
});
