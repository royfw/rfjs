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

  it('omits optional fields', () => {
    const schema = configToZod(config);
    expect(schema.safeParse({ name: 'Ada', agree: false, role: 'user' }).success).toBe(true);
  });

  it('rejects a Select value outside its options', () => {
    const schema = configToZod(config);
    expect(schema.safeParse({ name: 'Ada', agree: false, role: 'ghost' }).success).toBe(false);
  });
});
