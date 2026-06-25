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
