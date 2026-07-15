import { describe, it, expect } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { datasetsTable } from './table';

describe('datasetsTable', () => {
  it('maps to the "datasets" table with the expected columns', () => {
    const config = getTableConfig(datasetsTable);
    expect(config.name).toBe('datasets');
    const columns = config.columns.map((c) => c.name).sort();
    expect(columns).toEqual(
      ['created_at', 'data', 'dataset_id', 'description', 'name', 'updated_at'].sort(),
    );
  });

  it('makes name NOT NULL and id the primary key', () => {
    const config = getTableConfig(datasetsTable);
    const name = config.columns.find((c) => c.name === 'name');
    const id = config.columns.find((c) => c.name === 'dataset_id');
    expect(name?.notNull).toBe(true);
    expect(id?.primary).toBe(true);
  });
});
