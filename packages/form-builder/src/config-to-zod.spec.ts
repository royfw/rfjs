import { describe, it, expect } from 'vitest';
import { configToZod } from './config-to-zod';
import type { FormConfig } from './types';

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
});
