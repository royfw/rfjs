import { describe, it, expect } from 'vitest';
import { parseFormConfig, FormConfigSchema } from './config-schema';

const valid = {
  version: 1,
  fields: [
    { key: 'name', label: 'Name', component: 'Input', dataType: 'string', required: true },
    {
      key: 'role',
      label: 'Role',
      component: 'Select',
      dataType: 'string',
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'User', value: 'user' },
      ],
    },
  ],
};

describe('FormConfigSchema', () => {
  it('accepts a valid config', () => {
    expect(parseFormConfig(valid)).toEqual(valid);
  });

  it('rejects a field with an unknown component', () => {
    const bad = { version: 1, fields: [{ key: 'x', label: 'X', component: 'Wat', dataType: 'string' }] };
    expect(FormConfigSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a field with an unknown dataType', () => {
    const bad = { version: 1, fields: [{ key: 'x', label: 'X', component: 'Input', dataType: 'text' }] };
    expect(FormConfigSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a field with an empty key', () => {
    const bad = { version: 1, fields: [{ key: '', label: 'X', component: 'Input', dataType: 'string' }] };
    expect(FormConfigSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a non-integer version', () => {
    expect(FormConfigSchema.safeParse({ version: 1.5, fields: [] }).success).toBe(false);
  });
});

describe('grid layout fields', () => {
  it('accepts columns and per-field width', () => {
    const cfg = {
      version: 1,
      columns: 2,
      fields: [
        { key: 'name', label: 'Name', component: 'Input', dataType: 'string', width: 'half' },
        { key: 'bio', label: 'Bio', component: 'Textarea', dataType: 'string', width: 'full' },
      ],
    };
    expect(parseFormConfig(cfg)).toEqual(cfg);
  });

  it('rejects an out-of-range columns value', () => {
    expect(FormConfigSchema.safeParse({ version: 1, columns: 5, fields: [] }).success).toBe(false);
  });

  it('rejects an unknown width value', () => {
    const bad = { version: 1, fields: [{ key: 'x', label: 'X', component: 'Input', dataType: 'string', width: 'wide' }] };
    expect(FormConfigSchema.safeParse(bad).success).toBe(false);
  });

  it('still accepts a config without columns/width (backward compatible)', () => {
    expect(FormConfigSchema.safeParse({ version: 1, fields: [{ key: 'a', label: 'A', component: 'Input', dataType: 'string' }] }).success).toBe(true);
  });
});
