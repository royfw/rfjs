import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkAndCreateSchema } from './ensure-schema';
import { Client } from 'pg';

vi.mock('pg', () => {
  const mClient = {
    connect: vi.fn(),
    query: vi.fn(),
    end: vi.fn(),
  };
  return {
    Client: vi.fn(() => mClient),
  };
});

describe('checkAndCreateSchema', () => {
  const mockConnect = vi.fn();
  const mockQuery = vi.fn();
  const mockEnd = vi.fn();

  beforeEach(() => {
    vi.mocked(Client).mockImplementation(
      () =>
        ({
          connect: mockConnect,
          query: mockQuery,
          end: mockEnd,
        }) as unknown as Client,
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should create schemas', async () => {
    mockConnect.mockResolvedValue(undefined);
    mockQuery.mockResolvedValue({});

    const schemas = ['public', 'app_schema'];
    await checkAndCreateSchema('postgres://abc', schemas);

    expect(mockConnect).toHaveBeenCalled();
    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(mockQuery).toHaveBeenCalledWith('CREATE SCHEMA IF NOT EXISTS "public"');
    expect(mockQuery).toHaveBeenCalledWith('CREATE SCHEMA IF NOT EXISTS "app_schema"');
    expect(mockEnd).toHaveBeenCalled();
  });

  it('should handle empty schema list', async () => {
    mockConnect.mockResolvedValue(undefined);
    await checkAndCreateSchema('postgres://abc', []);
    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockEnd).toHaveBeenCalled();
  });

  it('escapes a malicious schema name', async () => {
    mockConnect.mockResolvedValue(undefined);
    mockQuery.mockResolvedValue({});
    await checkAndCreateSchema('postgres://abc', ['evil"; DROP SCHEMA public; --']);
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toBe('CREATE SCHEMA IF NOT EXISTS "evil""; DROP SCHEMA public; --"');
  });
});
