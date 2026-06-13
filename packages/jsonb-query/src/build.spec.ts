import { describe, it, expect } from 'vitest';
import { buildJsonbQuery } from './build';
import type { JsonbFilterGroup } from './types';

describe('buildJsonbQuery', () => {
  it('builds a single-condition where with contiguous params (legacy default)', () => {
    const filter: JsonbFilterGroup = {
      logic: 'and',
      filters: [{ field: 'age', dataType: 'numeric', operator: 'gt', value: 18 }],
    };
    expect(buildJsonbQuery('data', filter)).toEqual({
      where: '(("data" #>> $1)::numeric > $2)',
      values: [['age'], 18],
      from: [],
    });
  });

  it('joins conditions with the group logic and numbers params globally', () => {
    const filter: JsonbFilterGroup = {
      logic: 'and',
      filters: [
        { field: 'name', dataType: 'string', operator: 'eq', value: 'bob' },
        { field: 'age', dataType: 'numeric', operator: 'gte', value: 18 },
      ],
    };
    expect(buildJsonbQuery('data', filter)).toEqual({
      where: '(("data" #>> $1) = $2) and (("data" #>> $3)::numeric >= $4)',
      values: [['name'], 'bob', ['age'], 18],
      from: [],
    });
  });

  it('wraps nested groups in parentheses', () => {
    const filter: JsonbFilterGroup = {
      logic: 'and',
      filters: [
        { field: 'name', dataType: 'string', operator: 'eq', value: 'bob' },
        {
          logic: 'or',
          filters: [
            { field: 'age', dataType: 'numeric', operator: 'gte', value: 18 },
            { field: 'vip', dataType: 'boolean', operator: 'eq', value: true },
          ],
        },
      ],
    };
    const r = buildJsonbQuery('data', filter);
    expect(r.where).toBe(
      '(("data" #>> $1) = $2) and ((("data" #>> $3)::numeric >= $4) or (("data" #>> $5)::boolean = $6))',
    );
    expect(r.values).toEqual([['name'], 'bob', ['age'], 18, ['vip'], true]);
  });

  it('honours paramOffset', () => {
    const filter: JsonbFilterGroup = {
      logic: 'and',
      filters: [{ field: 'age', dataType: 'numeric', operator: 'gt', value: 18 }],
    };
    expect(buildJsonbQuery('data', filter, { paramOffset: 5 }).where).toBe(
      '(("data" #>> $6)::numeric > $7)',
    );
  });

  it('switches to the jsonpath dialect', () => {
    const filter: JsonbFilterGroup = {
      logic: 'and',
      filters: [{ field: 'name', dataType: 'string', operator: 'eq', value: 'bob' }],
    };
    expect(buildJsonbQuery('data', filter, { dialect: 'jsonpath' })).toEqual({
      where: 'jsonb_path_exists("data", $1::jsonpath, $2::jsonb)',
      values: ['$."name" ? (@ == $v)', { v: 'bob' }],
      from: [],
    });
  });

  it('returns empty where for an empty group', () => {
    expect(buildJsonbQuery('data', { logic: 'and', filters: [] })).toEqual({
      where: '',
      values: [],
      from: [],
    });
  });

  it('does not mutate across calls (fresh state each time)', () => {
    const filter: JsonbFilterGroup = {
      logic: 'and',
      filters: [{ field: 'age', dataType: 'numeric', operator: 'gt', value: 1 }],
    };
    const a = buildJsonbQuery('data', filter);
    const b = buildJsonbQuery('data', filter);
    expect(a).toEqual(b);
  });

  it('rejects an invalid column', () => {
    expect(() =>
      buildJsonbQuery('data; DROP', { logic: 'and', filters: [] }),
    ).toThrow(/invalid jsonb column/i);
  });

  it('throws for an unknown dialect', () => {
    expect(() =>
      buildJsonbQuery('data', { logic: 'and', filters: [] }, {
        dialect: 'nope' as never,
      }),
    ).toThrow(/unknown jsonb dialect/i);
  });

  it('rejects an operator that is invalid for the data type', () => {
    const bad = (dataType: never, operator: never) =>
      () => buildJsonbQuery('data', {
        logic: 'and',
        filters: [{ field: 'x', dataType, operator, value: 1 as never }],
      });
    expect(bad('boolean' as never, 'gt' as never)).toThrow(/unsupported operator "gt" for type "boolean"/i);
    expect(bad('string' as never, 'range' as never)).toThrow(/unsupported operator "range" for type "string"/i);
    expect(bad('numeric' as never, 'startswith' as never)).toThrow(/unsupported operator "startswith" for type "numeric"/i);
  });

  it('composes three levels of nesting with contiguous params', () => {
    const r = buildJsonbQuery('data', {
      logic: 'and',
      filters: [
        { field: 'a', dataType: 'string', operator: 'eq', value: 'x' },
        {
          logic: 'or',
          filters: [
            { field: 'b', dataType: 'numeric', operator: 'gt', value: 1 },
            {
              logic: 'and',
              filters: [
                { field: 'c', dataType: 'string', operator: 'eq', value: 'y' },
                { field: 'd', dataType: 'boolean', operator: 'eq', value: true },
              ],
            },
          ],
        },
      ],
    });
    // params run $1..$8 in order; each nested group is wrapped exactly once
    expect(r.where).toBe(
      '(("data" #>> $1) = $2) and ((("data" #>> $3)::numeric > $4) or ((("data" #>> $5) = $6) and (("data" #>> $7)::boolean = $8)))',
    );
    expect(r.values).toEqual([['a'], 'x', ['b'], 1, ['c'], 'y', ['d'], true]);
  });

  // Phase 2 condition types (object / scalar-array / elemmatch) are dispatched
  // and rendered by buildJsonbQuery as of Task 13; full end-to-end coverage
  // lives in the "buildJsonbQuery — phase 2" describe block below. This block
  // only guards that scalar rendering on the same field is unaffected.
  describe('phase-2 condition types', () => {
    it('still renders scalar conditions on the same field (no scalar regression)', () => {
      expect(
        buildJsonbQuery('data', {
          logic: 'and',
          filters: [{ field: 'profile', dataType: 'string', operator: 'eq', value: 'a' }],
        }),
      ).toEqual({
        where: '(("data" #>> $1) = $2)',
        values: [['profile'], 'a'],
        from: [],
      });
    });
  });
});

const GUARD = (col: string, ph: string) =>
  `case when jsonb_typeof(${col} #> ${ph}) = 'array' then ${col} #> ${ph} else '[]'::jsonb end`;

describe('buildJsonbQuery — phase 2', () => {
  it('object conditions render identically in both dialects', () => {
    const filter: JsonbFilterGroup = {
      logic: 'and',
      filters: [{ field: 'profile', dataType: 'object', operator: 'eq', value: { vip: true } }],
    };
    const legacy = buildJsonbQuery('data', filter);
    expect(legacy).toEqual({
      where: '(("data" #> $1) = $2::jsonb)',
      values: [['profile'], '{"vip":true}'],
      from: [],
    });
    expect(buildJsonbQuery('data', filter, { dialect: 'jsonpath' })).toEqual(legacy);
  });

  it('array element eq — legacy EXISTS vs jsonpath [*] filter', () => {
    const filter: JsonbFilterGroup = {
      logic: 'and',
      filters: [{ field: 'tags', dataType: 'array', elementType: 'string', operator: 'eq', value: 'a' }],
    };
    expect(buildJsonbQuery('data', filter)).toEqual({
      where: `(exists (select 1 from jsonb_array_elements_text(${GUARD('"data"', '$1')}) as e1(v) where (e1.v = $2)))`,
      values: [['tags'], 'a'],
      from: [],
    });
    expect(buildJsonbQuery('data', filter, { dialect: 'jsonpath' })).toEqual({
      where: 'jsonb_path_exists("data", $1::jsonpath, $2::jsonb)',
      values: ['$."tags"[*] ? (@ == $v)', { v: 'a' }],
      from: [],
    });
  });

  it('sibling array conditions get unique aliases and contiguous params (legacy)', () => {
    const r = buildJsonbQuery('data', {
      logic: 'and',
      filters: [
        { field: 'tags', dataType: 'array', elementType: 'string', operator: 'eq', value: 'a' },
        { field: 'nums', dataType: 'array', elementType: 'numeric', operator: 'gt', value: 5 },
      ],
    });
    expect(r.where).toBe(
      `(exists (select 1 from jsonb_array_elements_text(${GUARD('"data"', '$1')}) as e1(v) where (e1.v = $2))) and ` +
        `(exists (select 1 from jsonb_array_elements_text(${GUARD('"data"', '$3')}) as e2(v) where (e2.v::numeric > $4)))`,
    );
    expect(r.values).toEqual([['tags'], 'a', ['nums'], 5]);
  });

  it('containsall is identical in both dialects', () => {
    const filter: JsonbFilterGroup = {
      logic: 'and',
      filters: [{ field: 'tags', dataType: 'array', elementType: 'string', operator: 'containsall', value: ['a', 'b'] }],
    };
    const legacy = buildJsonbQuery('data', filter);
    expect(legacy).toEqual({
      where: '(("data" #> $1) @> $2::jsonb)',
      values: [['tags'], '["a","b"]'],
      from: [],
    });
    expect(buildJsonbQuery('data', filter, { dialect: 'jsonpath' })).toEqual(legacy);
  });

  it('elemmatch end-to-end (legacy)', () => {
    const filter: JsonbFilterGroup = {
      logic: 'and',
      filters: [
        {
          field: 'items', dataType: 'array', elementType: 'object', operator: 'elemmatch',
          filters: {
            logic: 'and',
            filters: [
              { field: 'sku', dataType: 'string', operator: 'eq', value: 'x' },
              { field: 'qty', dataType: 'numeric', operator: 'gt', value: 1 },
            ],
          },
        },
      ],
    };
    expect(buildJsonbQuery('data', filter)).toEqual({
      where:
        `(exists (select 1 from jsonb_array_elements(${GUARD('"data"', '$1')}) as e1 ` +
        'where ((e1.value #>> $2) = $3) and ((e1.value #>> $4)::numeric > $5)))',
      values: [['items'], ['sku'], 'x', ['qty'], 1],
      from: [],
    });
  });

  it('elemmatch end-to-end (jsonpath)', () => {
    const filter: JsonbFilterGroup = {
      logic: 'and',
      filters: [
        {
          field: 'items', dataType: 'array', elementType: 'object', operator: 'elemmatch',
          filters: {
            logic: 'and',
            filters: [
              { field: 'sku', dataType: 'string', operator: 'eq', value: 'x' },
              {
                logic: 'or',
                filters: [
                  { field: 'qty', dataType: 'numeric', operator: 'gt', value: 10 },
                  { field: 'flag', dataType: 'boolean', operator: 'eq', value: true },
                ],
              },
            ],
          },
        },
      ],
    };
    expect(buildJsonbQuery('data', filter, { dialect: 'jsonpath' })).toEqual({
      where: 'jsonb_path_exists("data", $1::jsonpath, $2::jsonb)',
      values: [
        '$."items"[*] ? (@."sku" == $v0 && (@."qty" > $v1 || @."flag" == $v2))',
        { v0: 'x', v1: 10, v2: true },
      ],
      from: [],
    });
  });

  it('nested elemmatch recurses in both dialects', () => {
    const filter: JsonbFilterGroup = {
      logic: 'and',
      filters: [
        {
          field: 'orders', dataType: 'array', elementType: 'object', operator: 'elemmatch',
          filters: {
            logic: 'and',
            filters: [
              { field: 'status', dataType: 'string', operator: 'eq', value: 'open' },
              {
                field: 'lines', dataType: 'array', elementType: 'object', operator: 'elemmatch',
                filters: { logic: 'and', filters: [{ field: 'sku', dataType: 'string', operator: 'eq', value: 'x' }] },
              },
            ],
          },
        },
      ],
    };
    expect(buildJsonbQuery('data', filter)).toEqual({
      where:
        `(exists (select 1 from jsonb_array_elements(${GUARD('"data"', '$1')}) as e1 ` +
        'where ((e1.value #>> $2) = $3) and ' +
        `(exists (select 1 from jsonb_array_elements(${GUARD('e1.value', '$4')}) as e2 where ((e2.value #>> $5) = $6)))))`,
      values: [['orders'], ['status'], 'open', ['lines'], ['sku'], 'x'],
      from: [],
    });
    expect(buildJsonbQuery('data', filter, { dialect: 'jsonpath' }).values).toEqual([
      '$."orders"[*] ? (@."status" == $v0 && exists (@."lines"[*] ? (@."sku" == $v1)))',
      { v0: 'open', v1: 'x' },
    ]);
  });

  it('mixes scalar and phase-2 conditions with contiguous params and honours paramOffset', () => {
    const r = buildJsonbQuery(
      'data',
      {
        logic: 'and',
        filters: [
          { field: 'name', dataType: 'string', operator: 'eq', value: 'bob' },
          { field: 'profile', dataType: 'object', operator: 'contains', value: { vip: true } },
          { field: 'tags', dataType: 'array', elementType: 'string', operator: 'eq', value: 'a' },
        ],
      },
      { paramOffset: 1 },
    );
    expect(r.where).toBe(
      '(("data" #>> $2) = $3) and (("data" #> $4) @> $5::jsonb) and ' +
        `(exists (select 1 from jsonb_array_elements_text(${GUARD('"data"', '$6')}) as e1(v) where (e1.v = $7)))`,
    );
    expect(r.values).toEqual([['name'], 'bob', ['profile'], '{"vip":true}', ['tags'], 'a']);
  });

  it('allows object and scalar-array conditions inside elemmatch (both dialects)', () => {
    const filter: JsonbFilterGroup = {
      logic: 'and',
      filters: [
        {
          field: 'items', dataType: 'array', elementType: 'object', operator: 'elemmatch',
          filters: {
            logic: 'and',
            filters: [
              { field: 'sku', dataType: 'string', operator: 'eq', value: 'x' },
              { field: 'meta', dataType: 'object', operator: 'contains', value: { vip: true } },
            ],
          },
        },
      ],
    };
    // legacy: a single EXISTS shell, object leaf via @>
    const legacy = buildJsonbQuery('data', filter);
    expect(legacy.where).toContain('jsonb_array_elements(');
    expect(legacy.where).toContain('@>');
    // jsonpath: object leaf forces the SQL EXISTS fallback — enabled in Task 4.
    // (The hybrid fallback delegation is implemented in jsonpath.ts in Task 4;
    // until then the jsonpath dialect cannot render an object leaf inside
    // elemmatch. Task 4 re-enables these assertions.)
  });

  it('throws when elemmatch filters are empty or render empty', () => {
    const empty: JsonbFilterGroup = {
      logic: 'and',
      filters: [
        {
          field: 'items', dataType: 'array', elementType: 'object', operator: 'elemmatch',
          filters: { logic: 'and', filters: [] },
        },
      ],
    };
    expect(() => buildJsonbQuery('data', empty)).toThrow(/requires a filter group/i);

    const rendersEmpty: JsonbFilterGroup = {
      logic: 'and',
      filters: [
        {
          field: 'items', dataType: 'array', elementType: 'object', operator: 'elemmatch',
          filters: { logic: 'and', filters: [{ logic: 'or', filters: [] }] },
        },
      ],
    };
    expect(() => buildJsonbQuery('data', rendersEmpty)).toThrow(/at least one condition/i);
    expect(() => buildJsonbQuery('data', rendersEmpty, { dialect: 'jsonpath' })).toThrow(
      /at least one condition/i,
    );
  });

  it('rejects invalid phase-2 operator combinations', () => {
    const one = (f: unknown) => () =>
      buildJsonbQuery('data', { logic: 'and', filters: [f as never] });
    expect(one({ field: 'p', dataType: 'object', operator: 'gt', value: {} })).toThrow(
      /unsupported operator "gt" for type "object"/i,
    );
    expect(
      one({ field: 't', dataType: 'array', elementType: 'string', operator: 'neq', value: 'x' }),
    ).toThrow(/unsupported operator "neq" for array elements/i);
    expect(
      one({ field: 'i', dataType: 'array', elementType: 'object', operator: 'eq', value: {} }),
    ).toThrow(/use "elemmatch"/i);
  });
});

describe('buildJsonbQuery — nor/not logical operators', () => {
  const GUARD2 = (col: string, ph: string) =>
    `case when jsonb_typeof(${col} #> ${ph}) = 'array' then ${col} #> ${ph} else '[]'::jsonb end`;

  it('not negates the conjunction of its children', () => {
    expect(
      buildJsonbQuery('data', {
        logic: 'not',
        filters: [
          { field: 'name', dataType: 'string', operator: 'eq', value: 'bob' },
          { field: 'age', dataType: 'numeric', operator: 'gt', value: 18 },
        ],
      }),
    ).toEqual({
      where: 'not ((("data" #>> $1) = $2) and (("data" #>> $3)::numeric > $4))',
      values: [['name'], 'bob', ['age'], 18],
      from: [],
    });
  });

  it('nor negates the disjunction of its children', () => {
    expect(
      buildJsonbQuery('data', {
        logic: 'nor',
        filters: [
          { field: 'name', dataType: 'string', operator: 'eq', value: 'bob' },
          { field: 'age', dataType: 'numeric', operator: 'gt', value: 18 },
        ],
      }).where,
    ).toBe('not ((("data" #>> $1) = $2) or (("data" #>> $3)::numeric > $4))');
  });

  it('expresses array not-contains in both dialects', () => {
    const filter: JsonbFilterGroup = {
      logic: 'not',
      filters: [
        { field: 'tags', dataType: 'array', elementType: 'string', operator: 'eq', value: 'a' },
      ],
    };
    expect(buildJsonbQuery('data', filter)).toEqual({
      where: `not ((exists (select 1 from jsonb_array_elements_text(${GUARD2('"data"', '$1')}) as e1(v) where (e1.v = $2))))`,
      values: [['tags'], 'a'],
      from: [],
    });
    expect(buildJsonbQuery('data', filter, { dialect: 'jsonpath' })).toEqual({
      where: 'not (jsonb_path_exists("data", $1::jsonpath, $2::jsonb))',
      values: ['$."tags"[*] ? (@ == $v)', { v: 'a' }],
      from: [],
    });
  });

  it('wraps a nested not group inside an and group', () => {
    expect(
      buildJsonbQuery('data', {
        logic: 'and',
        filters: [
          { field: 'name', dataType: 'string', operator: 'eq', value: 'bob' },
          {
            logic: 'not',
            filters: [{ field: 'vip', dataType: 'boolean', operator: 'eq', value: true }],
          },
        ],
      }).where,
    ).toBe('(("data" #>> $1) = $2) and (not ((("data" #>> $3)::boolean = $4)))');
  });

  it('supports not groups inside elemmatch (legacy)', () => {
    expect(
      buildJsonbQuery('data', {
        logic: 'and',
        filters: [
          {
            field: 'items', dataType: 'array', elementType: 'object', operator: 'elemmatch',
            filters: {
              logic: 'and',
              filters: [
                { field: 'sku', dataType: 'string', operator: 'eq', value: 'x' },
                {
                  logic: 'not',
                  filters: [{ field: 'qty', dataType: 'numeric', operator: 'gt', value: 5 }],
                },
              ],
            },
          },
        ],
      }).where,
    ).toBe(
      `(exists (select 1 from jsonb_array_elements(${GUARD2('"data"', '$1')}) as e1 ` +
        'where ((e1.value #>> $2) = $3) and (not (((e1.value #>> $4)::numeric > $5)))))',
    );
  });

  it('drops empty not/nor groups (phase-1 empty-group convention)', () => {
    expect(buildJsonbQuery('data', { logic: 'not', filters: [] }).where).toBe('');
    expect(buildJsonbQuery('data', { logic: 'nor', filters: [] }).where).toBe('');
  });
});
