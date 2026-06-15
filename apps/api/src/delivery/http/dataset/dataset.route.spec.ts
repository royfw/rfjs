import { describe, it, expect, vi, beforeAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { CreateDatasetInputSchema } from '@rfjs/core';
import { JsonbQueryError } from '@rfjs/jsonb-query';
import { ColumnQueryError } from '@rfjs/sql-filter';
import { PgFilterError } from '@rfjs/pg-filter';

vi.mock('@/infrastructures/datasource', () => ({
  datasetUsecases: {
    list: vi.fn().mockResolvedValue([
      {
        id: '1',
        name: 'A',
        description: null,
        data: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]),
    get: vi.fn().mockResolvedValue(undefined),
    create: vi.fn().mockImplementation((input) =>
      Promise.resolve({
        id: '2',
        description: null,
        data: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        ...input,
      }),
    ),
    query: vi.fn().mockResolvedValue({
      items: [
        {
          id: '1',
          name: 'A',
          description: null,
          data: { region: 'apac' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    }),
  },
}));

describe('dataset routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const { initializeFastifyApp } = await import('@/infrastructures');
    const { datasetHttpRouteModule } = await import('./module');
    app = await initializeFastifyApp({
      httpRouteModules: [datasetHttpRouteModule],
      isApiDocEnabled: false,
    });
    await app.ready();
  });

  it('GET /datasets returns the list', async () => {
    const res = await app.inject({ method: 'GET', url: '/datasets' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });

  it('POST /datasets creates and returns 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/datasets',
      payload: { name: 'New' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json<{ name: string }>().name).toBe('New');
  });

  it('GET /datasets/:id returns 200 when found', async () => {
    const { datasetUsecases } = await import('@/infrastructures/datasource');
    const dataset = {
      id: 'abc',
      name: 'Found',
      description: null,
      data: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(datasetUsecases.get).mockResolvedValueOnce(dataset);
    const res = await app.inject({ method: 'GET', url: '/datasets/abc' });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ id: string }>().id).toBe('abc');
  });

  it('GET /datasets/:id returns 404 when not found', async () => {
    const { datasetUsecases } = await import('@/infrastructures/datasource');
    vi.mocked(datasetUsecases.get).mockResolvedValueOnce(undefined);
    const res = await app.inject({ method: 'GET', url: '/datasets/missing' });
    expect(res.statusCode).toBe(404);
  });

  it('POST /datasets with invalid body returns 400 (ZodError mapped)', async () => {
    const { datasetUsecases } = await import('@/infrastructures/datasource');
    vi.mocked(datasetUsecases.create).mockRejectedValueOnce(
      CreateDatasetInputSchema.safeParse({}).error!,
    );
    const res = await app.inject({ method: 'POST', url: '/datasets', payload: {} });
    expect(res.statusCode).toBe(400);
    expect(res.json<{ error: string }>().error).toBe('Bad Request');
  });

  it('POST /datasets/query returns 200 with items and total', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/datasets/query',
      payload: {
        filter: {
          logic: 'and',
          filters: [
            {
              target: 'jsonb',
              field: 'region',
              dataType: 'string',
              operator: 'eq',
              value: 'apac',
            },
          ],
        },
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ items: unknown[]; total: number }>();
    expect(body.items).toHaveLength(1);
    expect(body.total).toBe(1);
  });

  it('POST /datasets/query maps JsonbQueryError to 400', async () => {
    const { datasetUsecases } = await import('@/infrastructures/datasource');
    vi.mocked(datasetUsecases.query).mockRejectedValueOnce(
      new JsonbQueryError('bad operator', 'UNSUPPORTED_OPERATOR'),
    );
    const res = await app.inject({
      method: 'POST',
      url: '/datasets/query',
      payload: { filter: { logic: 'and', filters: [] } },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json<{ error: string }>().error).toBe('Bad Request');
  });

  it('POST /datasets/query maps ColumnQueryError to 400', async () => {
    const { datasetUsecases } = await import('@/infrastructures/datasource');
    vi.mocked(datasetUsecases.query).mockRejectedValueOnce(
      new ColumnQueryError('unknown column', 'UNKNOWN_COLUMN'),
    );
    const res = await app.inject({
      method: 'POST',
      url: '/datasets/query',
      payload: { filter: { logic: 'and', filters: [] } },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json<{ code: string }>().code).toBe('UNKNOWN_COLUMN');
  });

  it('POST /datasets/query maps PgFilterError to 400', async () => {
    const { datasetUsecases } = await import('@/infrastructures/datasource');
    vi.mocked(datasetUsecases.query).mockRejectedValueOnce(
      new PgFilterError('bad target', 'INVALID_TARGET'),
    );
    const res = await app.inject({
      method: 'POST',
      url: '/datasets/query',
      payload: { filter: { logic: 'and', filters: [] } },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json<{ code: string }>().code).toBe('INVALID_TARGET');
  });
});
