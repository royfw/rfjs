import { describe, it, expect } from 'vitest';
import { ColumnQueryError } from '../errors';
import { buildColumnQuery } from './build';
import type { ColumnConfig } from './config';

const config: ColumnConfig = {
  name: { column: 'name', type: 'text' },
  createdAt: { column: 'created_at', type: 'timestamp' },
};

describe('buildColumnQuery', () => {
  it('builds a parameterized WHERE over allowlisted columns', () => {
    const r = buildColumnQuery(config, {
      logic: 'and',
      filters: [
        { column: 'name', operator: 'contains', value: 'sales' },
        { column: 'createdAt', operator: 'gte', value: '2026-01-01' },
      ],
    });
    expect(r.where).toBe('"name" ilike \'%\' || $1 || \'%\' and "created_at" >= $2');
    expect(r.values).toEqual(['sales', '2026-01-01']);
  });

  it('supports nested logic and the paramOffset option', () => {
    const r = buildColumnQuery(
      config,
      {
        logic: 'or',
        filters: [
          { column: 'name', operator: 'eq', value: 'a' },
          { logic: 'and', filters: [{ column: 'name', operator: 'eq', value: 'b' }] },
        ],
      },
      { paramOffset: 3 },
    );
    expect(r.where).toBe('"name" = $4 or ("name" = $5)');
    expect(r.values).toEqual(['a', 'b']);
  });

  it('rejects a column not in the config', () => {
    expect(() =>
      buildColumnQuery(config, { logic: 'and', filters: [{ column: 'evil', operator: 'eq', value: 1 }] }),
    ).toThrow(ColumnQueryError);
  });

  it('rejects a negative/non-integer paramOffset', () => {
    expect(() => buildColumnQuery(config, { logic: 'and', filters: [] }, { paramOffset: -1 })).toThrow(
      ColumnQueryError,
    );
  });
});
