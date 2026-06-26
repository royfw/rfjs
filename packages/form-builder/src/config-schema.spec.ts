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

describe('localized labels', () => {
  it('accepts a record label', () => {
    const cfg = { version: 1, fields: [{ key: 'n', label: { en: 'Name', 'zh-TW': '姓名' }, component: 'Input', dataType: 'string' }] };
    expect(parseFormConfig(cfg)).toEqual(cfg);
  });
  it('still accepts a string label', () => {
    expect(FormConfigSchema.safeParse({ version: 1, fields: [{ key: 'n', label: 'Name', component: 'Input', dataType: 'string' }] }).success).toBe(true);
  });
  it('rejects a numeric label', () => {
    expect(FormConfigSchema.safeParse({ version: 1, fields: [{ key: 'n', label: 5, component: 'Input', dataType: 'string' }] }).success).toBe(false);
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

describe('FieldValidation schema', () => {
  const baseField = { key: 'x', label: 'X', component: 'Input', dataType: 'numeric' };

  it('accepts a field with numeric min/max', () => {
    const cfg = { version: 1, fields: [{ ...baseField, validation: { min: 0, max: 100 } }] };
    expect(FormConfigSchema.safeParse(cfg).success).toBe(true);
  });

  it('accepts a field with string minLength/maxLength/pattern/message', () => {
    const cfg = {
      version: 1,
      fields: [
        {
          key: 'zip',
          label: 'Zip',
          component: 'Input',
          dataType: 'string',
          validation: { minLength: 5, maxLength: 10, pattern: '^\\d+$', message: 'Invalid' },
        },
      ],
    };
    expect(FormConfigSchema.safeParse(cfg).success).toBe(true);
  });

  it('rejects non-numeric min', () => {
    const cfg = { version: 1, fields: [{ ...baseField, validation: { min: 'zero' } }] };
    expect(FormConfigSchema.safeParse(cfg).success).toBe(false);
  });

  it('rejects non-numeric max', () => {
    const cfg = { version: 1, fields: [{ ...baseField, validation: { max: true } }] };
    expect(FormConfigSchema.safeParse(cfg).success).toBe(false);
  });

  it('rejects non-numeric minLength', () => {
    const cfg = { version: 1, fields: [{ ...baseField, validation: { minLength: '3' } }] };
    expect(FormConfigSchema.safeParse(cfg).success).toBe(false);
  });

  it('rejects non-numeric maxLength', () => {
    const cfg = { version: 1, fields: [{ ...baseField, validation: { maxLength: null } }] };
    expect(FormConfigSchema.safeParse(cfg).success).toBe(false);
  });

  it('rejects non-string pattern', () => {
    const cfg = { version: 1, fields: [{ ...baseField, validation: { pattern: 123 } }] };
    expect(FormConfigSchema.safeParse(cfg).success).toBe(false);
  });

  it('accepts validation with no fields (all optional)', () => {
    const cfg = { version: 1, fields: [{ ...baseField, validation: {} }] };
    expect(FormConfigSchema.safeParse(cfg).success).toBe(true);
  });

  it('accepts a field without validation (backward compatible)', () => {
    const cfg = { version: 1, fields: [{ ...baseField }] };
    expect(FormConfigSchema.safeParse(cfg).success).toBe(true);
  });

  it('rejects a field with an invalid regex pattern', () => {
    const cfg = {
      version: 1,
      fields: [
        {
          key: 'test',
          label: 'Test',
          component: 'Input',
          dataType: 'string',
          validation: { pattern: '[unclosed' },
        },
      ],
    };
    expect(FormConfigSchema.safeParse(cfg).success).toBe(false);
  });

  it('accepts a field with a valid regex pattern', () => {
    const cfg = {
      version: 1,
      fields: [
        {
          key: 'test',
          label: 'Test',
          component: 'Input',
          dataType: 'string',
          validation: { pattern: '^[a-z]+$' },
        },
      ],
    };
    expect(FormConfigSchema.safeParse(cfg).success).toBe(true);
  });
});

describe('conditional field visibility schema', () => {
  const baseField = { key: 'x', label: 'X', component: 'Input', dataType: 'string' };

  it('accepts a field with a valid conditional rule', () => {
    const cfg = {
      version: 1,
      fields: [
        {
          ...baseField,
          conditional: {
            logic: 'and',
            filters: [{ field: 'role', dataType: 'string', operator: 'eq', value: 'admin' }],
          },
        },
      ],
    };
    expect(FormConfigSchema.safeParse(cfg).success).toBe(true);
  });

  it('accepts a field with an empty filters array', () => {
    const cfg = {
      version: 1,
      fields: [{ ...baseField, conditional: { logic: 'and', filters: [] } }],
    };
    expect(FormConfigSchema.safeParse(cfg).success).toBe(true);
  });

  it('accepts a field without conditional (backward compatible)', () => {
    const cfg = { version: 1, fields: [{ ...baseField }] };
    expect(FormConfigSchema.safeParse(cfg).success).toBe(true);
  });

  it('rejects a conditional with an invalid logic value', () => {
    const cfg = {
      version: 1,
      fields: [
        {
          ...baseField,
          conditional: { logic: 'xyz', filters: [] },
        },
      ],
    };
    expect(FormConfigSchema.safeParse(cfg).success).toBe(false);
  });

  it('rejects a conditional missing the logic key', () => {
    const cfg = {
      version: 1,
      fields: [
        {
          ...baseField,
          conditional: { filters: [] },
        },
      ],
    };
    expect(FormConfigSchema.safeParse(cfg).success).toBe(false);
  });
});
