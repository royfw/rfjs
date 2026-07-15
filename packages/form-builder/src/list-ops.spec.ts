import { describe, it, expect } from 'vitest';
import { addField, removeField, updateField, moveField } from './list-ops';
import type { FormConfig, FieldConfig } from './types';

const f = (key: string): FieldConfig => ({ key, label: key, component: 'Input', dataType: 'string' });
const base: FormConfig = { version: 1, fields: [f('a'), f('b'), f('c')] };

describe('list-ops', () => {
  it('addField appends by default and does not mutate input', () => {
    const out = addField(base, f('d'));
    expect(out.fields.map((x) => x.key)).toEqual(['a', 'b', 'c', 'd']);
    expect(base.fields).toHaveLength(3); // input untouched
  });

  it('addField inserts at an index', () => {
    expect(addField(base, f('x'), 1).fields.map((x) => x.key)).toEqual(['a', 'x', 'b', 'c']);
  });

  it('removeField drops the matching key', () => {
    expect(removeField(base, 'b').fields.map((x) => x.key)).toEqual(['a', 'c']);
  });

  it('updateField merges a patch into the matching field only', () => {
    const out = updateField(base, 'b', { label: 'Bee', required: true });
    expect(out.fields[1]).toMatchObject({ key: 'b', label: 'Bee', required: true });
    expect(out.fields[0]).toEqual(f('a'));
  });

  it('moveField reorders', () => {
    expect(moveField(base, 0, 2).fields.map((x) => x.key)).toEqual(['b', 'c', 'a']);
  });

  it('moveField is a no-op for an out-of-range source', () => {
    expect(moveField(base, 9, 0)).toEqual(base);
  });
});
