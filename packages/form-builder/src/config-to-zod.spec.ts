import { describe, it, expect } from 'vitest';
import { configToZod } from './config-to-zod';
import type { FormConfig, FieldConfig } from './types';

/** Wraps a single partial FieldConfig into a minimal FormConfig for test convenience. */
function mkConfig(partial: Pick<FieldConfig, 'key' | 'component'> & Partial<FieldConfig>): FormConfig {
  const defaultDataType: Partial<Record<FieldConfig['component'], FieldConfig['dataType']>> = {
    CheckboxGroup: 'array',
    TagList: 'array',
    Checkbox: 'boolean',
    Switch: 'boolean',
    Number: 'numeric',
  };
  const field = {
    label: partial.key,
    dataType: defaultDataType[partial.component] ?? 'string',
    ...partial,
  } as FieldConfig;
  return { version: 1, fields: [field] };
}

const config: FormConfig = {
  version: 1,
  fields: [
    { key: 'name', label: 'Name', component: 'Input', dataType: 'string', required: true },
    { key: 'age', label: 'Age', component: 'Input', dataType: 'numeric' },
    { key: 'agree', label: 'Agree', component: 'Checkbox', dataType: 'boolean' },
    {
      key: 'role',
      label: 'Role',
      component: 'Select',
      dataType: 'string',
      options: [{ label: 'Admin', value: 'admin' }, { label: 'User', value: 'user' }],
    },
  ],
};

describe('configToZod', () => {
  it('accepts well-formed data and coerces numeric strings', () => {
    const schema = configToZod(config);
    const parsed = schema.parse({ name: 'Ada', age: '42', agree: true, role: 'admin' });
    expect(parsed).toEqual({ name: 'Ada', age: 42, agree: true, role: 'admin' });
  });

  it('rejects an empty value for a required string field', () => {
    const schema = configToZod(config);
    expect(schema.safeParse({ name: '', age: 1, agree: false, role: 'admin' }).success).toBe(false);
  });

  it('omits optional fields and their parsed value is undefined', () => {
    const schema = configToZod(config);
    const result = schema.safeParse({ name: 'Ada', agree: false, role: 'user' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.age).toBeUndefined();
    }
  });

  it('optional numeric with empty string parses to undefined (not 0)', () => {
    const schema = configToZod(config);
    const result = schema.safeParse({ name: 'Ada', age: '', agree: false, role: 'user' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.age).toBeUndefined();
    }
  });

  it('required numeric with empty string fails validation', () => {
    const requiredNumericConfig: FormConfig = {
      version: 1,
      fields: [{ key: 'score', label: 'Score', component: 'Input', dataType: 'numeric', required: true }],
    };
    const schema = configToZod(requiredNumericConfig);
    expect(schema.safeParse({ score: '' }).success).toBe(false);
  });

  it('optional Select with empty string parses to undefined', () => {
    const optionalSelectConfig: FormConfig = {
      version: 1,
      fields: [
        {
          key: 'role',
          label: 'Role',
          component: 'Select',
          dataType: 'string',
          options: [{ label: 'Admin', value: 'admin' }, { label: 'User', value: 'user' }],
        },
      ],
    };
    const schema = configToZod(optionalSelectConfig);
    const result = schema.safeParse({ role: '' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBeUndefined();
    }
  });

  it('rejects a Select value outside its options', () => {
    const schema = configToZod(config);
    expect(schema.safeParse({ name: 'Ada', agree: false, role: 'ghost' }).success).toBe(false);
  });
});

describe('configToZod — validation rules', () => {
  it('rejects a numeric value below min', () => {
    const cfg: FormConfig = {
      version: 1,
      fields: [
        {
          key: 'age',
          label: 'Age',
          component: 'Input',
          dataType: 'numeric',
          required: true,
          validation: { min: 0 },
        },
      ],
    };
    const schema = configToZod(cfg);
    expect(schema.safeParse({ age: -1 }).success).toBe(false);
    expect(schema.safeParse({ age: 0 }).success).toBe(true);
  });

  it('rejects a numeric value above max', () => {
    const cfg: FormConfig = {
      version: 1,
      fields: [
        {
          key: 'score',
          label: 'Score',
          component: 'Input',
          dataType: 'numeric',
          required: true,
          validation: { max: 100 },
        },
      ],
    };
    const schema = configToZod(cfg);
    expect(schema.safeParse({ score: 101 }).success).toBe(false);
    expect(schema.safeParse({ score: 100 }).success).toBe(true);
  });

  it('rejects a string shorter than minLength', () => {
    const cfg: FormConfig = {
      version: 1,
      fields: [
        {
          key: 'name',
          label: 'Name',
          component: 'Input',
          dataType: 'string',
          required: true,
          validation: { minLength: 3 },
        },
      ],
    };
    const schema = configToZod(cfg);
    expect(schema.safeParse({ name: 'ab' }).success).toBe(false);
    expect(schema.safeParse({ name: 'abc' }).success).toBe(true);
  });

  it('rejects a string longer than maxLength', () => {
    const cfg: FormConfig = {
      version: 1,
      fields: [
        {
          key: 'code',
          label: 'Code',
          component: 'Input',
          dataType: 'string',
          required: true,
          validation: { maxLength: 5 },
        },
      ],
    };
    const schema = configToZod(cfg);
    expect(schema.safeParse({ code: 'toolong' }).success).toBe(false);
    expect(schema.safeParse({ code: 'ok' }).success).toBe(true);
  });

  it('rejects a string not matching the pattern', () => {
    const cfg: FormConfig = {
      version: 1,
      fields: [
        {
          key: 'zip',
          label: 'Zip',
          component: 'Input',
          dataType: 'string',
          required: true,
          validation: { pattern: '^\\d{5}$' },
        },
      ],
    };
    const schema = configToZod(cfg);
    expect(schema.safeParse({ zip: '1234' }).success).toBe(false);
    expect(schema.safeParse({ zip: '12345' }).success).toBe(true);
  });

  it('surfaces a custom message when validation fails', () => {
    const cfg: FormConfig = {
      version: 1,
      fields: [
        {
          key: 'age',
          label: 'Age',
          component: 'Input',
          dataType: 'numeric',
          required: true,
          validation: { min: 18, message: 'Must be at least 18' },
        },
      ],
    };
    const schema = configToZod(cfg);
    const result = schema.safeParse({ age: 10 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages.some((m) => m.includes('Must be at least 18'))).toBe(true);
    }
  });

  it('optional field with validation still omits on empty string', () => {
    const cfg: FormConfig = {
      version: 1,
      fields: [
        {
          key: 'age',
          label: 'Age',
          component: 'Input',
          dataType: 'numeric',
          validation: { min: 0, max: 120 },
        },
      ],
    };
    const schema = configToZod(cfg);
    // empty string → undefined (omitted), not a validation failure
    const result = schema.safeParse({ age: '' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.age).toBeUndefined();
    }
  });

  it('optional field with validation still validates present values', () => {
    const cfg: FormConfig = {
      version: 1,
      fields: [
        {
          key: 'age',
          label: 'Age',
          component: 'Input',
          dataType: 'numeric',
          validation: { min: 0, max: 120 },
        },
      ],
    };
    const schema = configToZod(cfg);
    expect(schema.safeParse({ age: -5 }).success).toBe(false);
    expect(schema.safeParse({ age: 25 }).success).toBe(true);
  });

  it('does not throw when given a field with an invalid regex pattern (defensive try/catch)', () => {
    // Construct config directly, bypassing schema validation
    const cfg: FormConfig = {
      version: 1,
      fields: [
        {
          key: 'test',
          label: 'Test',
          component: 'Input',
          dataType: 'string',
          required: true,
          validation: { pattern: '[unclosed' }, // malformed regex
        },
      ],
    };
    // Should not throw; invalid pattern is skipped silently
    expect(() => configToZod(cfg)).not.toThrow();
    // Schema is still usable (just without the regex constraint)
    const schema = configToZod(cfg);
    expect(schema.safeParse({ test: 'anything' }).success).toBe(true);
  });
});

describe('configToZod — new component types', () => {
  it('Email: rejects a non-email string, accepts a valid email', () => {
    const cfg: FormConfig = {
      version: 1,
      fields: [{ key: 'email', label: 'Email', component: 'Email', dataType: 'string', required: true }],
    };
    const schema = configToZod(cfg);
    expect(schema.safeParse({ email: 'not-an-email' }).success).toBe(false);
    expect(schema.safeParse({ email: 'a@b.com' }).success).toBe(true);
    expect(schema.safeParse({ email: '' }).success).toBe(false); // required empty fails
  });

  it('Email: optional — empty string omits without error', () => {
    const cfg: FormConfig = {
      version: 1,
      fields: [{ key: 'email', label: 'Email', component: 'Email', dataType: 'string' }],
    };
    const schema = configToZod(cfg);
    const result = schema.safeParse({ email: '' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBeUndefined();
  });

  it('Email: minLength and email format both apply', () => {
    const cfg: FormConfig = {
      version: 1,
      fields: [
        {
          key: 'email',
          label: 'Email',
          component: 'Email',
          dataType: 'string',
          required: true,
          validation: { minLength: 10 },
        },
      ],
    };
    const schema = configToZod(cfg);
    // Valid email format but only 7 chars — fails minLength
    expect(schema.safeParse({ email: 'a@b.com' }).success).toBe(false);
    // Invalid email format — fails email check regardless
    expect(schema.safeParse({ email: 'notanemail' }).success).toBe(false);
    // Valid email and long enough
    expect(schema.safeParse({ email: 'user@example.com' }).success).toBe(true);
  });

  it('Email: pattern and email format both apply', () => {
    const cfg: FormConfig = {
      version: 1,
      fields: [
        {
          key: 'email',
          label: 'Email',
          component: 'Email',
          dataType: 'string',
          required: true,
          validation: { pattern: '@company\\.com$' },
        },
      ],
    };
    const schema = configToZod(cfg);
    expect(schema.safeParse({ email: 'user@gmail.com' }).success).toBe(false); // valid email, wrong domain
    expect(schema.safeParse({ email: 'notanemail' }).success).toBe(false);
    expect(schema.safeParse({ email: 'user@company.com' }).success).toBe(true);
  });

  it('Number: validates numeric values and respects min/max', () => {
    const cfg: FormConfig = {
      version: 1,
      fields: [
        {
          key: 'qty',
          label: 'Qty',
          component: 'Number',
          dataType: 'numeric',
          required: true,
          validation: { min: 1, max: 10 },
        },
      ],
    };
    const schema = configToZod(cfg);
    expect(schema.safeParse({ qty: 0 }).success).toBe(false);   // below min
    expect(schema.safeParse({ qty: 11 }).success).toBe(false);  // above max
    expect(schema.safeParse({ qty: 5 }).success).toBe(true);
    expect(schema.safeParse({ qty: '5' }).success).toBe(true);  // coerced
  });

  it('Switch: validates boolean values', () => {
    const cfg: FormConfig = {
      version: 1,
      fields: [{ key: 'active', label: 'Active', component: 'Switch', dataType: 'boolean' }],
    };
    const schema = configToZod(cfg);
    expect(schema.safeParse({ active: true }).success).toBe(true);
    expect(schema.safeParse({ active: false }).success).toBe(true);
    expect(schema.safeParse({ active: 'yes' }).success).toBe(false);
  });

  it('Radio: rejects a value not in options (behaves like enum)', () => {
    const cfg: FormConfig = {
      version: 1,
      fields: [
        {
          key: 'size',
          label: 'Size',
          component: 'Radio',
          dataType: 'string',
          options: [{ label: 'S', value: 'small' }, { label: 'L', value: 'large' }],
        },
      ],
    };
    const schema = configToZod(cfg);
    expect(schema.safeParse({ size: 'medium' }).success).toBe(false);
    expect(schema.safeParse({ size: 'small' }).success).toBe(true);
  });
});

describe('configToZod — v1/v2 shape compatibility', () => {
  it('builds the schema from a v2 sections config (field items only)', () => {
    const cfg = { version: 1, sections: [{ id: 's1', rows: [
      { id: 'r1', items: [{ id: 'name', kind: 'field', key: 'name', label: 'Name', component: 'Input', dataType: 'string', required: true }] },
      { id: 'r2', items: [{ id: 'c', kind: 'content', text: 'note' }, { id: 'd', kind: 'divider' }] },
    ] }] };
    const schema = configToZod(cfg as any);
    expect(schema.safeParse({ name: 'x' }).success).toBe(true);
    expect(schema.safeParse({}).success).toBe(false);          // required name
    expect(Object.keys(schema.shape)).toEqual(['name']);        // content/divider produce no keys
  });

  it('still builds the schema from a v1 fields[] config (back-compat)', () => {
    const cfg = { version: 1, fields: [{ key: 'name', label: 'Name', component: 'Input', dataType: 'string', required: true }] };
    expect(configToZod(cfg as any).safeParse({ name: 'a' }).success).toBe(true);
  });
});

describe('configToZod — multi-value components', () => {
  it('validates CheckboxGroup as string[] not a single string', () => {
    const schema = configToZod(mkConfig({ key: 'g', component: 'CheckboxGroup',
      options: [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }] }));
    expect(schema.safeParse({ g: ['a', 'b'] }).success).toBe(true);
    expect(schema.safeParse({ g: 'a' }).success).toBe(false);
  });

  it('required CheckboxGroup rejects empty array', () => {
    const schema = configToZod(mkConfig({ key: 'g', component: 'CheckboxGroup', required: true,
      options: [{ label: 'A', value: 'a' }] }));
    expect(schema.safeParse({ g: [] }).success).toBe(false);
    expect(schema.safeParse({ g: ['a'] }).success).toBe(true);
  });

  it('creatable TagList accepts arbitrary strings', () => {
    const schema = configToZod(mkConfig({ key: 't', component: 'TagList', creatable: true }));
    expect(schema.safeParse({ t: ['anything', 'new-tag'] }).success).toBe(true);
  });

  it('required single Checkbox must be true', () => {
    const schema = configToZod(mkConfig({ key: 'agree', component: 'Checkbox', required: true }));
    expect(schema.safeParse({ agree: false }).success).toBe(false);
    expect(schema.safeParse({ agree: true }).success).toBe(true);
  });

  it('non-creatable TagList with options validates as enum array', () => {
    const schema = configToZod(mkConfig({ key: 't', component: 'TagList',
      options: [{ label: 'X', value: 'x' }] }));
    expect(schema.safeParse({ t: ['x'] }).success).toBe(true);
    expect(schema.safeParse({ t: 'x' }).success).toBe(false);        // single string rejected
    expect(schema.safeParse({ t: ['unknown'] }).success).toBe(false); // out-of-enum rejected
  });
});
