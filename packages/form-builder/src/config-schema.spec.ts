import { describe, it, expect } from 'vitest';
import { parseFormConfig, FormConfigSchema, fieldConfigSchema, formConfigSchema } from './config-schema';

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

describe('v1/v2 parse', () => {
  it('parses a v1 flat fields[] config (back-compat)', () => {
    const cfg = { version: 1, fields: [{ key: 'name', label: 'Name', component: 'Input', dataType: 'string' }] };
    expect(parseFormConfig(cfg)).toEqual(cfg);
  });

  it('parses a v2 sections config with mixed item kinds', () => {
    const cfg = {
      version: 1,
      sections: [{
        id: 's1', rows: [
          { id: 'r1', items: [{ id: 'i1', kind: 'field', key: 'name', label: 'Name', component: 'Input', dataType: 'string' }] },
          { id: 'r2', items: [{ id: 'i2', kind: 'content', text: 'Hello' }, { id: 'i3', kind: 'divider' }] },
          { id: 'r3', items: [{ id: 'i4', kind: 'spacer', size: 'md' }, { id: 'i5', kind: 'ai-note', text: 'fill carefully' }] },
        ],
      }],
    };
    expect(parseFormConfig(cfg)).toEqual(cfg);
  });

  it('rejects an item with an unknown kind', () => {
    const cfg = { version: 1, sections: [{ id: 's1', rows: [{ id: 'r1', items: [{ id: 'i1', kind: 'nope' }] }] }] };
    expect(() => parseFormConfig(cfg)).toThrow();
  });

  it('rejects a config with neither fields nor sections', () => {
    expect(() => parseFormConfig({ version: 1 })).toThrow();
  });
});

describe('dataSource schema', () => {
  const baseFieldDs = {
    key: 'country',
    label: 'Country',
    component: 'Select',
    dataType: 'string',
    dataSource: {
      request: { url: 'https://api.example.com/countries', method: 'GET' },
      extract: { dialect: 'path', expr: 'data' },
      fallback: '無',
      optionLabel: 'name',
      optionValue: 'code',
    },
  };

  it('accepts a fieldConfig with a valid dataSource (round-trip)', () => {
    const cfg = { version: 1, fields: [baseFieldDs] };
    expect(FormConfigSchema.safeParse(cfg).success).toBe(true);
  });

  it('accepts a content item with a valid dataSource', () => {
    const cfg = {
      version: 1,
      sections: [{
        id: 's1',
        rows: [{
          id: 'r1',
          items: [{
            id: 'i1',
            kind: 'content',
            text: 'Status',
            dataSource: {
              request: { url: 'https://api.example.com/status' },
              extract: { dialect: 'jsonata', expr: 'result.value' },
            },
          }],
        }],
      }],
    };
    expect(FormConfigSchema.safeParse(cfg).success).toBe(true);
  });

  it('rejects a dataSource missing extract.expr', () => {
    const bad = {
      version: 1,
      fields: [{
        ...baseFieldDs,
        dataSource: { request: { url: 'https://example.com' }, extract: { dialect: 'path' } },
      }],
    };
    expect(FormConfigSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a dataSource with an invalid dialect', () => {
    const bad = {
      version: 1,
      fields: [{
        ...baseFieldDs,
        dataSource: { request: { url: 'https://example.com' }, extract: { dialect: 'bad', expr: 'data' } },
      }],
    };
    expect(FormConfigSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a dataSource missing request.url', () => {
    const bad = {
      version: 1,
      fields: [{
        ...baseFieldDs,
        dataSource: { request: { method: 'GET' }, extract: { dialect: 'path', expr: 'data' } },
      }],
    };
    expect(FormConfigSchema.safeParse(bad).success).toBe(false);
  });
});

describe('new FieldComponent values', () => {
  it.each(['Number', 'Email', 'Switch', 'Radio', 'DatePicker'] as const)(
    'accepts component: %s',
    (component) => {
      const cfg = { version: 1, fields: [{ key: 'x', label: 'X', component, dataType: 'string' }] };
      expect(FormConfigSchema.safeParse(cfg).success).toBe(true);
    }
  );

  it('still rejects an unknown component', () => {
    const cfg = { version: 1, fields: [{ key: 'x', label: 'X', component: 'Widget', dataType: 'string' }] };
    expect(FormConfigSchema.safeParse(cfg).success).toBe(false);
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

describe('CheckboxGroup/TagList + new props', () => {
  it('accepts CheckboxGroup with description/disabled/readOnly', () => {
    const r = fieldConfigSchema.safeParse({
      key: 'tags', label: 'Tags', component: 'CheckboxGroup', dataType: 'array',
      options: [{ label: 'A', value: 'a' }],
      description: 'pick some', disabled: false, readOnly: true,
    });
    expect(r.success).toBe(true);
  });

  it('requires options for non-creatable TagList', () => {
    const r = fieldConfigSchema.safeParse({ key: 't', label: 'T', component: 'TagList', dataType: 'array' });
    expect(r.success).toBe(false);
  });

  it('allows creatable TagList without options', () => {
    const r = fieldConfigSchema.safeParse({ key: 't', label: 'T', component: 'TagList', dataType: 'array', creatable: true });
    expect(r.success).toBe(true);
  });

  it('preserves description (LocalizedLabel record) and elementType on round-trip', () => {
    const cfg = {
      version: 1,
      sections: [{ id: 's', title: 'S', rows: [{ id: 'r', items: [
        {
          id: 'f1', kind: 'field',
          key: 'tags', label: { en: 'Tags', 'zh-TW': '標籤' }, component: 'CheckboxGroup', dataType: 'string',
          description: { en: 'help', 'zh-TW': '說明' }, options: [{ label: 'A', value: 'a' }],
          conditional: {
            logic: 'and',
            filters: [{ field: 'tags', dataType: 'string', operator: 'terms', value: ['a'], elementType: 'string' }],
          },
        },
      ] }] }],
    };
    const parsed = formConfigSchema.parse(cfg);
    expect(JSON.parse(JSON.stringify(parsed))).toEqual(cfg);
  });
});

describe('TagList validation in sections path', () => {
  const makeTagListItem = (extra: Record<string, unknown> = {}) => ({
    id: 'tl1',
    kind: 'field',
    key: 'tags',
    label: 'Tags',
    component: 'TagList',
    dataType: 'array',
    ...extra,
  });

  it('rejects a non-creatable TagList without options in sections[].rows[].items[]', () => {
    const cfg = {
      version: 1,
      sections: [{ id: 's1', rows: [{ id: 'r1', items: [makeTagListItem()] }] }],
    };
    expect(FormConfigSchema.safeParse(cfg).success).toBe(false);
  });

  it('accepts a creatable TagList without options in sections[].rows[].items[]', () => {
    const cfg = {
      version: 1,
      sections: [{ id: 's1', rows: [{ id: 'r1', items: [makeTagListItem({ creatable: true })] }] }],
    };
    expect(FormConfigSchema.safeParse(cfg).success).toBe(true);
  });

  it('accepts a TagList with options in sections[].rows[].items[]', () => {
    const cfg = {
      version: 1,
      sections: [{
        id: 's1',
        rows: [{ id: 'r1', items: [makeTagListItem({ options: [{ label: 'A', value: 'a' }] })] }],
      }],
    };
    expect(FormConfigSchema.safeParse(cfg).success).toBe(true);
  });
});

describe('FormConfig grid layout', () => {
  const gridConfig = {
    version: 1,
    sections: [
      {
        id: 's1',
        title: 'Account',
        rows: [{ id: 's1_row', items: [
          { id: 'i_name', kind: 'field', key: 'name', label: 'Name', component: 'Input', dataType: 'string' },
        ] }],
        layout: {
          columns: 12,
          placements: [{ itemId: 'i_name', colStart: 1, colSpan: 6, row: 1 }],
        },
      },
    ],
  };

  it('round-trips a section.layout (col/span/row survive strip-mode)', () => {
    const parsed = parseFormConfig(gridConfig);
    expect(parsed.sections![0]!.layout).toEqual({
      columns: 12,
      placements: [{ itemId: 'i_name', colStart: 1, colSpan: 6, row: 1 }],
    });
  });

  it('rejects a placement with colSpan < 1', () => {
    const bad = structuredClone(gridConfig);
    bad.sections[0]!.layout!.placements[0]!.colSpan = 0;
    expect(() => parseFormConfig(bad)).toThrow();
  });
});

describe('FileUpload/Signature components', () => {
  it('accepts FileUpload with fileUpload config and Signature', () => {
    expect(fieldConfigSchema.safeParse({
      key: 'f', label: 'F', component: 'FileUpload', dataType: 'array',
      fileUpload: { accept: 'image/*', multiple: true, maxSize: 5_000_000 },
    }).success).toBe(true);
    expect(fieldConfigSchema.safeParse({
      key: 's', label: 'S', component: 'Signature', dataType: 'string',
    }).success).toBe(true);
  });

  it('rejects FileUpload with an invalid fileUpload.multiple type', () => {
    expect(fieldConfigSchema.safeParse({
      key: 'f', label: 'F', component: 'FileUpload', dataType: 'array',
      fileUpload: { multiple: 'yes' },
    }).success).toBe(false);
  });
});
