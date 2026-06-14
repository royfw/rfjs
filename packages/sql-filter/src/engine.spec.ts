import { describe, it, expect } from 'vitest';
import { ParamBuilder } from './param-builder';
import { buildFilterGroup } from './engine';
import type { FilterGroup } from './types';

type FakeLeaf = { token: string };
const renderFake = (leaf: FakeLeaf, p: ParamBuilder) => `${leaf.token}=${p.add(leaf.token)}`;
const g = (group: FilterGroup<FakeLeaf>) => {
  const p = new ParamBuilder();
  return { sql: buildFilterGroup(group, renderFake, p), values: p.values };
};

describe('buildFilterGroup', () => {
  it('joins leaves with the group logic', () => {
    expect(g({ logic: 'and', filters: [{ token: 'a' }, { token: 'b' }] }).sql).toBe('a=$1 and b=$2');
    expect(g({ logic: 'or', filters: [{ token: 'a' }, { token: 'b' }] }).sql).toBe('a=$1 or b=$2');
  });

  it('negates not/nor', () => {
    expect(g({ logic: 'not', filters: [{ token: 'a' }, { token: 'b' }] }).sql).toBe('not (a=$1 and b=$2)');
    expect(g({ logic: 'nor', filters: [{ token: 'a' }, { token: 'b' }] }).sql).toBe('not (a=$1 or b=$2)');
  });

  it('applies empty-group identity', () => {
    expect(g({ logic: 'and', filters: [] }).sql).toBe('true');
    expect(g({ logic: 'or', filters: [] }).sql).toBe('false');
    expect(g({ logic: 'not', filters: [] }).sql).toBe('false');
    expect(g({ logic: 'nor', filters: [] }).sql).toBe('true');
  });

  it('wraps nested groups in parentheses', () => {
    const r = g({
      logic: 'and',
      filters: [{ token: 'a' }, { logic: 'or', filters: [{ token: 'b' }, { token: 'c' }] }],
    });
    expect(r.sql).toBe('a=$1 and (b=$2 or c=$3)');
    expect(r.values).toEqual(['a', 'b', 'c']);
  });

  it('continues placeholder numbering from the ParamBuilder offset', () => {
    const p = new ParamBuilder(5);
    const sql = buildFilterGroup({ logic: 'and', filters: [{ token: 'a' }] }, renderFake, p);
    expect(sql).toBe('a=$6');
  });
});
