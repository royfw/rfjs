import { describe, it, expect, vi } from 'vitest';
import type { Db } from '@rfjs/db';
import { makeDatasetRepository } from './repository';

function fakeDb(query: ReturnType<typeof vi.fn>): Db {
  return { $client: { query } } as unknown as Db;
}

const row = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'cust',
  description: null,
  data: { score: 90 },
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
};

describe('makeDatasetRepository.query', () => {
  it('runs the main + COUNT queries and returns items with total', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [row] }) // main
      .mockResolvedValueOnce({ rows: [{ total: 1 }] }); // count
    const repo = makeDatasetRepository(fakeDb(query));

    const res = await repo.query({
      filter: { logic: 'and', filters: [{ target: 'column', column: 'name', operator: 'contains', value: 'cust' }] },
      page: 1,
      pageSize: 20,
    });

    expect(res.total).toBe(1);
    expect(res.items).toHaveLength(1);
    expect(res.items[0].name).toBe('cust');

    expect(query).toHaveBeenCalledTimes(2);
    const [mainSql, mainValues] = query.mock.calls[0];
    const [countSql, countValues] = query.mock.calls[1];
    expect(mainSql).toContain('ORDER BY');
    expect(mainSql).toContain('LIMIT 20');
    expect(mainSql).toContain('OFFSET 0');
    expect(countSql).toContain('COUNT(*)');
    expect(countSql).not.toContain('ORDER BY');
    expect(countValues).toEqual(['cust']);
    expect(mainValues[0]).toBe('cust');
  });

  it('always appends a stable tiebreaker so ORDER BY is deterministic', async () => {
    const query = vi.fn().mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ total: 0 }] });
    const repo = makeDatasetRepository(fakeDb(query));
    await repo.query({ page: 1, pageSize: 20 });
    const [mainSql] = query.mock.calls[0];
    expect(mainSql).toContain('created_at');
    expect(mainSql).toContain('dataset_id');
  });
});
