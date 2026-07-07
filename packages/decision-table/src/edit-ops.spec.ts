import { describe, expect, it } from 'vitest';

import { emptyTable, newRule, moveRule } from './edit-ops';
import { decisionTableSchema } from './schema';

let seq = 0;
const id = () => `id-${++seq}`;

describe('edit-ops', () => {
  it('emptyTable is schema-valid with one output column and no rules', () => {
    const t = emptyTable();
    expect(() => decisionTableSchema.parse(t)).not.toThrow();
    expect(t.rules).toEqual([]);
    expect(t.outputs.length).toBe(1);
    expect(t.hitPolicy).toBe('first');
  });

  it('newRule creates a rule with an empty and-group and unique ids', () => {
    const a = newRule(id);
    const b = newRule(id);
    expect(a.when.kind).toBe('group');
    expect(a.when.logic).toBe('and');
    expect(a.when.children).toEqual([]);
    expect(a.id).not.toBe(b.id);
    expect(a.outputs).toEqual({});
  });

  it('moveRule reorders immutably and no-ops when out of range', () => {
    const t = { ...emptyTable(), rules: [newRule(id), newRule(id), newRule(id)] };
    const ids = t.rules.map((r) => r.id);
    const moved = moveRule(t, 0, 2);
    expect(moved.rules.map((r) => r.id)).toEqual([ids[1], ids[2], ids[0]]);
    expect(t.rules.map((r) => r.id)).toEqual(ids); // 原物件不變
    expect(moveRule(t, -1, 0)).toBe(t);
    expect(moveRule(t, 0, 99)).toBe(t);
  });
});
