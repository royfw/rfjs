import { describe, expect, it } from 'vitest';

import { decisionTableSchema, parseTable, tableToJson } from './schema';
import type { DecisionTable } from './types';

const WHEN = { kind: 'group', id: 'g1', logic: 'and', children: [] } as const;

const VALID: DecisionTable = {
  version: 1,
  name: 'routing',
  outputs: [{ key: 'approver', label: 'Approver' }],
  hitPolicy: 'first',
  rules: [{ id: 'r1', when: { ...WHEN }, outputs: { approver: 'Manager' } }],
  defaultOutputs: { approver: 'Direct Manager' },
};

describe('decisionTableSchema', () => {
  it('accepts a valid table and round-trips through JSON', () => {
    expect(() => decisionTableSchema.parse(VALID)).not.toThrow();
    expect(parseTable(tableToJson(VALID))).toEqual(VALID);
  });

  it('rejects a bad version, bad hitPolicy, and missing outputs', () => {
    expect(() => decisionTableSchema.parse({ ...VALID, version: 2 })).toThrow();
    expect(() => decisionTableSchema.parse({ ...VALID, hitPolicy: 'unique' })).toThrow();
    expect(() => decisionTableSchema.parse({ ...VALID, outputs: undefined })).toThrow();
  });

  it('rejects a rule whose when is not a group shell', () => {
    const bad = { ...VALID, rules: [{ id: 'r1', when: { nope: true }, outputs: {} }] };
    expect(() => decisionTableSchema.parse(bad)).toThrow();
  });

  it('rejects duplicated rule ids', () => {
    const bad = {
      ...VALID,
      rules: [
        { id: 'dup', when: { ...WHEN }, outputs: {} },
        { id: 'dup', when: { ...WHEN, id: 'g2' }, outputs: {} },
      ],
    };
    expect(() => decisionTableSchema.parse(bad)).toThrow();
  });

  it('parseTable throws on invalid JSON text', () => {
    expect(() => parseTable('not json')).toThrow();
    expect(() => parseTable('{"version":1}')).toThrow();
  });
});
