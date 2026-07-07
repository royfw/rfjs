import { describe, it, expect } from 'vitest';
import { ColumnQueryError } from '../errors';
import { buildColumnOrderBy } from './order-by';
import type { ColumnConfig } from './config';

const config: ColumnConfig = {
  name: { column: 'name', type: 'text' },
  createdAt: { column: 'created_at', type: 'timestamp' },
};

describe('buildColumnOrderBy', () => {
  it('renders multiple sort keys with direction and nulls', () => {
    const r = buildColumnOrderBy(config, [
      { column: 'createdAt', direction: 'desc' },
      { column: 'name', direction: 'asc', nulls: 'last' },
    ]);
    expect(r.orderBy).toBe('"created_at" desc, "name" asc nulls last');
    expect(r.values).toEqual([]);
  });

  it('defaults direction to asc', () => {
    expect(buildColumnOrderBy(config, [{ column: 'name' }]).orderBy).toBe('"name" asc');
  });

  it('rejects an unknown column and an invalid direction/nulls', () => {
    expect(() => buildColumnOrderBy(config, [{ column: 'evil' }])).toThrow(ColumnQueryError);
    expect(() =>
      buildColumnOrderBy(config, [{ column: 'name', direction: 'sideways' as never }]),
    ).toThrow(ColumnQueryError);
    expect(() => buildColumnOrderBy(config, [{ column: 'name', nulls: 'middle' as never }])).toThrow(
      ColumnQueryError,
    );
  });
});
