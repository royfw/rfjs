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
