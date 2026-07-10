import { describe, expect, it } from 'vitest';
import { parseDataResourceMeta } from '@rfjs/data-schema';
import type { RequestMeta, ResponseMeta } from '@rfjs/data-schema';
import { deriveTableConfig } from './derive';
import { tableConfigToResourceMeta } from './reverse';
import type { TableConfig } from './types';

const REQUEST: RequestMeta = {
  endpoint: '/api/items',
  pagination: { strategy: 'offset', limitParam: 'limit', offsetParam: 'offset' },
};
const RESPONSE: ResponseMeta = { rowsPath: 'data.items', totalPath: 'data.total' };

describe('tableConfigToResourceMeta', () => {
  it('maps columns to fields, dropping display-only keys (visible/pin/align)', () => {
    const config: TableConfig = {
      columns: [
        {
          key: 'name',
          label: { en: 'Name' },
          dataType: 'string',
          sortable: true,
          filterable: true,
          visible: false,
          pin: 'left',
          align: 'center',
        },
        { key: 'price', label: 'Price', dataType: 'numeric', format: 'currency', options: [{ value: 1, label: 'One' }] },
      ],
      pagination: { pageSize: 10 },
    };

    const meta = tableConfigToResourceMeta(config);

    expect(meta).toEqual({
      fields: [
        { key: 'name', label: { en: 'Name' }, dataType: 'string', sortable: true, filterable: true },
        { key: 'price', label: 'Price', dataType: 'numeric', format: 'currency', options: [{ value: 1, label: 'One' }] },
      ],
    }); // toEqual 同時釘住:optional 欄缺省不寫、無 request/response 鍵
  });

  it('passes request/response through when provided, omits them when not', () => {
    const config: TableConfig = {
      columns: [{ key: 'id', label: 'ID', dataType: 'numeric' }],
      pagination: { pageSize: 10 },
    };

    const withProtocol = tableConfigToResourceMeta(config, REQUEST, RESPONSE);
    expect(withProtocol.request).toEqual(REQUEST);
    expect(withProtocol.response).toEqual(RESPONSE);

    const bare = tableConfigToResourceMeta(config);
    expect('request' in bare).toBe(false);
    expect('response' in bare).toBe(false);
  });

  it('copies label and options so mutating the meta does not touch the config', () => {
    const config: TableConfig = {
      columns: [
        {
          key: 'status',
          label: { en: 'Status' },
          dataType: 'string',
          options: [{ value: 'active', label: { en: 'Active' } }],
        },
      ],
      pagination: { pageSize: 10 },
    };

    const meta = tableConfigToResourceMeta(config);

    expect(meta.fields[0]!.label).not.toBe(config.columns[0]!.label);
    expect(meta.fields[0]!.options).not.toBe(config.columns[0]!.options);
    expect(meta.fields[0]!.options?.[0]).not.toBe(config.columns[0]!.options?.[0]);
    (meta.fields[0]!.label as Record<string, string>).en = 'CHANGED';
    expect((config.columns[0]!.label as Record<string, string>).en).toBe('Status');
  });

  it('round-trips derive: tableConfigToResourceMeta(deriveTableConfig(meta)).fields equals meta.fields', () => {
    const fields = [
      { key: 'name', label: { en: 'Name' }, dataType: 'string' as const, sortable: true, filterable: true },
      { key: 'price', label: 'Price', dataType: 'numeric' as const, format: 'currency' as const },
    ];

    const roundTripped = tableConfigToResourceMeta(deriveTableConfig({ fields }));

    expect(roundTripped.fields).toEqual(fields);
  });

  it('produces output that passes parseDataResourceMeta', () => {
    const config: TableConfig = {
      columns: [{ key: 'id', label: 'ID', dataType: 'numeric' }],
      pagination: { pageSize: 10 },
    };

    expect(() => parseDataResourceMeta(tableConfigToResourceMeta(config, REQUEST, RESPONSE))).not.toThrow();
  });
});
