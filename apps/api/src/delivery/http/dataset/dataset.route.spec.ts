import { describe, it, expect, vi, beforeAll } from 'vitest';
import type { FastifyInstance } from 'fastify';

vi.mock('@/infrastructures/datasource', () => ({
  datasetUsecases: {
    list: vi.fn().mockResolvedValue([{ id: '1', name: 'A', description: null, data: {}, createdAt: new Date(), updatedAt: new Date() }]),
    get: vi.fn(),
    create: vi.fn().mockImplementation((input) => Promise.resolve({ id: '2', description: null, data: {}, createdAt: new Date(), updatedAt: new Date(), ...input })),
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
    const res = await app.inject({ method: 'POST', url: '/datasets', payload: { name: 'New' } });
    expect(res.statusCode).toBe(201);
    expect(res.json().name).toBe('New');
  });
});
