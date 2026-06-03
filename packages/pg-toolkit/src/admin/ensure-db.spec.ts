import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkAndCreateDB } from './ensure-db';
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

describe('checkAndCreateDB', () => {
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

  it('should create database if it does not exist', async () => {
    mockConnect.mockResolvedValue(undefined);
    // First query checks existence (returns 0 rows)
    // Second query creates database
    mockQuery
      .mockResolvedValueOnce({ rowCount: 0 })
      .mockResolvedValueOnce({ rowCount: 1 });

    await checkAndCreateDB('postgres://user:pass@localhost:5432/target_db');

    expect(Client).toHaveBeenCalled();
    expect(mockConnect).toHaveBeenCalled();
    // Check existence query
    expect(mockQuery).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('SELECT 1 FROM pg_database'),
      ['target_db'],
    );
    // Create query
    expect(mockQuery).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('CREATE DATABASE "target_db"'),
    );
    expect(mockEnd).toHaveBeenCalled();
  });

  it('should not create database if it already exists', async () => {
    mockConnect.mockResolvedValue(undefined);
    mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // Exists

    await checkAndCreateDB('postgres://user:pass@localhost:5432/target_db');

    expect(mockQuery).toHaveBeenCalledTimes(1); // Only check test
    expect(mockQuery).not.toHaveBeenCalledWith(
      expect.stringContaining('CREATE DATABASE'),
    );
    expect(mockEnd).toHaveBeenCalled();
  });

  it('should handle admin connection string derivation', async () => {
    mockConnect.mockResolvedValue(undefined);
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });

    await checkAndCreateDB('postgres://user:pass@localhost:5432/target_db');

    // Admin connection targets the `postgres` database, derived from the parsed
    // fields rather than a hand-rebuilt connection string.
    expect(Client).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'localhost',
        port: 5432,
        user: 'user',
        password: 'pass',
        database: 'postgres',
      }),
    );
  });

  it('preserves a password containing URL-special characters', async () => {
    mockConnect.mockResolvedValue(undefined);
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });

    // password decodes to `p@ss:word` — rebuilding a URL string would corrupt it
    await checkAndCreateDB('postgres://user:p%40ss%3Aword@localhost:5432/target_db');

    expect(Client).toHaveBeenCalledWith(
      expect.objectContaining({ password: 'p@ss:word', database: 'postgres' }),
    );
  });

  it('omits the port when the connection string has none', async () => {
    mockConnect.mockResolvedValue(undefined);
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });

    await checkAndCreateDB('postgres://user:pass@localhost/target_db');

    const cfg = vi.mocked(Client).mock.calls[0][0] as { port?: number };
    expect(cfg.port).toBeUndefined();
  });

  it('escapes a malicious target database name in CREATE DATABASE', async () => {
    mockConnect.mockResolvedValue(undefined);
    mockQuery
      .mockResolvedValueOnce({ rowCount: 0 })
      .mockResolvedValueOnce({ rowCount: 1 });

    await checkAndCreateDB('postgres://user:pass@localhost:5432/ev%22il');

    expect(mockQuery).toHaveBeenNthCalledWith(2, 'CREATE DATABASE "ev""il"');
  });
});
