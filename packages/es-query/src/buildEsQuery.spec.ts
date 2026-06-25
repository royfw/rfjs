import { describe, it, expect } from 'vitest';
import { buildEsQuery } from './buildEsQuery';
import type { EsFilterMetadata } from './types';

describe('buildEsQuery', () => {
  it('and group → must', () => {
    const meta: EsFilterMetadata = {
      logic: 'and',
      filters: [
        { field: 'status', condition: 'eq', value: 'open' },
        { field: 'age', condition: 'gt', dataType: 'number', value: 18 },
      ],
    };
    expect(buildEsQuery(meta)).toEqual({
      bool: {
        must: [{ term: { status: 'open' } }, { range: { age: { gt: 18 } } }],
      },
    });
  });

  it('or group → should + minimum_should_match', () => {
    const meta: EsFilterMetadata = {
      logic: 'or',
      filters: [
        { field: 'a', condition: 'eq', value: '1' },
        { field: 'b', condition: 'eq', value: '2' },
      ],
    };
    expect(buildEsQuery(meta)).toEqual({
      bool: {
        should: [{ term: { a: '1' } }, { term: { b: '2' } }],
        minimum_should_match: 1,
      },
    });
  });

  it('nested or inside and', () => {
    const meta: EsFilterMetadata = {
      logic: 'and',
      filters: [
        { field: 'status', condition: 'eq', value: 'open' },
        {
          logic: 'or',
          filters: [
            { field: 'age', condition: 'gt', dataType: 'number', value: 18 },
            { field: 'vip', condition: 'eq', dataType: 'boolean', value: true },
          ],
        },
      ],
    };
    expect(buildEsQuery(meta)).toEqual({
      bool: {
        must: [
          { term: { status: 'open' } },
          {
            bool: {
              should: [{ range: { age: { gt: 18 } } }, { term: { vip: true } }],
              minimum_should_match: 1,
            },
          },
        ],
      },
    });
  });

  it('not group (single child) → must_not', () => {
    const meta: EsFilterMetadata = {
      logic: 'not',
      filters: [{ field: 'status', condition: 'eq', value: 'archived' }],
    };
    expect(buildEsQuery(meta)).toEqual({
      bool: { must_not: [{ term: { status: 'archived' } }] },
    });
  });

  // not = NOT(a AND b) = "not all"; the children must be wrapped in a single
  // bool/must so must_not negates their conjunction (not each one).
  it('not group (multi child) → must_not of bool/must (negated AND)', () => {
    const meta: EsFilterMetadata = {
      logic: 'not',
      filters: [
        { field: 'status', condition: 'eq', value: 'open' },
        { field: 'age', condition: 'gt', dataType: 'number', value: 18 },
      ],
    };
    expect(buildEsQuery(meta)).toEqual({
      bool: {
        must_not: [
          {
            bool: {
              must: [{ term: { status: 'open' } }, { range: { age: { gt: 18 } } }],
            },
          },
        ],
      },
    });
  });

  // nor = NOT(a OR b) = "none match" = each clause directly under must_not.
  it('nor group (multi child) → must_not of each clause (negated OR)', () => {
    const meta: EsFilterMetadata = {
      logic: 'nor',
      filters: [
        { field: 'status', condition: 'eq', value: 'open' },
        { field: 'age', condition: 'gt', dataType: 'number', value: 18 },
      ],
    };
    expect(buildEsQuery(meta)).toEqual({
      bool: {
        must_not: [{ term: { status: 'open' } }, { range: { age: { gt: 18 } } }],
      },
    });
  });
});
