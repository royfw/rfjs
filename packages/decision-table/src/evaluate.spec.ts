import { describe, expect, it } from 'vitest';

import { evaluateTable, DecisionTableError } from './evaluate';
import type { DecisionTable } from './types';
import type { BuilderGroup } from '@rfjs/filter-builder';

const cond = (id: string, field: string, operator: string, value: unknown, dataType = 'numeric'): BuilderGroup => ({
  kind: 'group',
  id: `g-${id}`,
  logic: 'and',
  children: [{ kind: 'condition', id: `c-${id}`, field, dataType: dataType as never, operator, value }],
});

const TABLE: DecisionTable = {
  version: 1,
  outputs: [{ key: 'approver' }, { key: 'note' }],
  hitPolicy: 'first',
  rules: [
    { id: 'big', when: cond('big', 'amount', 'gt', 100000), outputs: { approver: 'CFO' } },
    { id: 'eng', when: {
        kind: 'group', id: 'g-eng', logic: 'and',
        children: [
          { kind: 'condition', id: 'c-a', field: 'amount', dataType: 'numeric', operator: 'gt', value: 50000 },
          { kind: 'condition', id: 'c-d', field: 'dept', dataType: 'string', operator: 'eq', value: 'Engineering' },
        ],
      }, outputs: { approver: 'VP Engineering', note: '= "routed for " & dept' } },
  ],
  defaultOutputs: { approver: 'Direct Manager' },
};

describe('evaluateTable — hit policies', () => {
  it('first: takes the first matching rule only', async () => {
    const r = await evaluateTable(TABLE, { amount: 200000, dept: 'Engineering' });
    expect(r.matched).toEqual(['big']);
    expect(r.outputs).toEqual({ approver: 'CFO' });
    expect(r.usedDefault).toBe(false);
    expect(r.ruleErrors).toEqual([]);
  });

  it('collect: gathers every matching rule in order (array)', async () => {
    const t: DecisionTable = { ...TABLE, hitPolicy: 'collect' };
    const r = await evaluateTable(t, { amount: 200000, dept: 'Engineering' });
    expect(r.matched).toEqual(['big', 'eng']);
    expect(Array.isArray(r.outputs)).toBe(true);
    expect((r.outputs as Record<string, unknown>[])[0]).toEqual({ approver: 'CFO' });
  });

  it('no match + defaultOutputs → usedDefault (first: record; collect: single-element array)', async () => {
    const rFirst = await evaluateTable(TABLE, { amount: 10, dept: 'HR' });
    expect(rFirst.matched).toEqual([]);
    expect(rFirst.usedDefault).toBe(true);
    expect(rFirst.outputs).toEqual({ approver: 'Direct Manager' });

    const rCollect = await evaluateTable({ ...TABLE, hitPolicy: 'collect' }, { amount: 10, dept: 'HR' });
    expect(rCollect.usedDefault).toBe(true);
    expect(rCollect.outputs).toEqual([{ approver: 'Direct Manager' }]);
  });

  it('no match + no default → first: null; collect: []', async () => {
    const noDefault: DecisionTable = { ...TABLE, defaultOutputs: undefined };
    expect((await evaluateTable(noDefault, { amount: 1 })).outputs).toBeNull();
    expect((await evaluateTable({ ...noDefault, hitPolicy: 'collect' }, { amount: 1 })).outputs).toEqual([]);
  });
});

describe('evaluateTable — "=" expressions', () => {
  it('resolves expression outputs against the context (nested paths work)', async () => {
    const r = await evaluateTable(TABLE, { amount: 60000, dept: 'Engineering' });
    expect(r.matched).toEqual(['eng']);
    expect(r.outputs).toEqual({ approver: 'VP Engineering', note: 'routed for Engineering' });
  });

  it('expression failure → key undefined + ruleErrors (non-strict), throws in strict', async () => {
    const bad: DecisionTable = {
      ...TABLE,
      rules: [{ id: 'r1', when: cond('r1', 'amount', 'gt', 0), outputs: { approver: '= $notAFunction(' } }],
    };
    const r = await evaluateTable(bad, { amount: 5 });
    expect(r.matched).toEqual(['r1']);
    expect((r.outputs as Record<string, unknown>).approver).toBeUndefined();
    expect(r.ruleErrors).toHaveLength(1);
    expect(r.ruleErrors[0]).toMatchObject({ ruleId: 'r1', kind: 'expression' });

    await expect(evaluateTable(bad, { amount: 5 }, { strict: true })).rejects.toBeInstanceOf(DecisionTableError);
  });
});

describe('evaluateTable — uncoverable rules', () => {
  const uncoverable: DecisionTable = {
    ...TABLE,
    defaultOutputs: undefined,
    rules: [
      { id: 'u1', when: cond('u1', 'amount', 'not-a-real-op', 1), outputs: { approver: 'X' } },
      { id: 'ok', when: cond('ok', 'amount', 'gt', 0), outputs: { approver: 'Manager' } },
    ],
  };

  it('skips the uncoverable rule, records ruleErrors, and still evaluates the rest', async () => {
    const r = await evaluateTable(uncoverable, { amount: 5 });
    expect(r.ruleErrors).toHaveLength(1);
    expect(r.ruleErrors[0]).toMatchObject({ ruleId: 'u1', kind: 'uncoverable' });
    expect(r.matched).toEqual(['ok']);
    expect(r.outputs).toEqual({ approver: 'Manager' });
  });

  it('strict → throws DecisionTableError immediately', async () => {
    await expect(evaluateTable(uncoverable, { amount: 5 }, { strict: true })).rejects.toBeInstanceOf(DecisionTableError);
  });
});

describe('evaluateTable — boundaries', () => {
  it('validates the table at the boundary (invalid table throws)', async () => {
    await expect(evaluateTable({ version: 2 } as never, {})).rejects.toThrow();
  });

  it('empty rules → default or null; elemmatch nesting matches array items', async () => {
    const empty: DecisionTable = { ...TABLE, rules: [], defaultOutputs: undefined };
    expect((await evaluateTable(empty, {})).outputs).toBeNull();

    const withElem: DecisionTable = {
      ...TABLE,
      defaultOutputs: undefined,
      rules: [{
        id: 'elem',
        when: {
          kind: 'group', id: 'g-e', logic: 'and',
          children: [{
            kind: 'condition', id: 'c-e', field: 'items', dataType: 'array', elementType: 'object',
            operator: 'elemmatch',
            filters: cond('inner', 'price', 'gt', 10000),
          }],
        },
        outputs: { approver: 'Procurement' },
      }],
    };
    const r = await evaluateTable(withElem, { items: [{ price: 5 }, { price: 20000 }] });
    expect(r.matched).toEqual(['elem']);
  });
});
