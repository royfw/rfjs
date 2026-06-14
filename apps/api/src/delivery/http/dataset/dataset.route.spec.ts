import { describe, it, expect, vi, beforeAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { CreateDatasetInputSchema } from '@rfjs/core';

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
});
