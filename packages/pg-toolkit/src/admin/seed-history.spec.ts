import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ensureSeedHistoryTable,
  checkSeedExecuted,
  recordSeedExecution,
} from './seed-history';

// Mock对象
const mockQuery = vi.fn();
const mockClient = {
  query: mockQuery,
};

describe('seed-history', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe('ensureSeedHistoryTable', () => {
    it('should create table if not exists', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      // @ts-expect-error - partial mock
      await ensureSeedHistoryTable(mockClient);
      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(mockQuery.mock.calls[0][0]).toContain(
        'CREATE TABLE IF NOT EXISTS "__seed_history"',
      );
    });

    it('should use custom table name', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      // @ts-expect-error - partial mock
      await ensureSeedHistoryTable(mockClient, 'custom_seeds');
      expect(mockQuery.mock.calls[0][0]).toContain(
        'CREATE TABLE IF NOT EXISTS "custom_seeds"',
      );
    });
  });

  describe('checkSeedExecuted', () => {
    it('should return true if seed exists', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });
      // @ts-expect-error - partial mock
      const result = await checkSeedExecuted(mockClient, 'seed1');
      expect(result).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT 1 FROM "__seed_history"'),
        ['seed1'],
      );
    });

    it('should return false if seed does not exist', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0 });
      // @ts-expect-error - partial mock
      const result = await checkSeedExecuted(mockClient, 'seed1');
      expect(result).toBe(false);
    });
  });

  describe('recordSeedExecution', () => {
    it('should insert seed record', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });
      // @ts-expect-error - partial mock
      await recordSeedExecution(mockClient, 'seed1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO "__seed_history"'),
        ['seed1'],
      );
    });
  });

  describe('identifier safety', () => {
    it('escapes a malicious table name in ensureSeedHistoryTable', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      // @ts-expect-error - partial mock
      await ensureSeedHistoryTable(mockClient, 'evil"; DROP TABLE users; --');
      const sql = mockQuery.mock.calls[0][0] as string;
      expect(sql).toContain('"evil""; DROP TABLE users; --"');
      // the injected closing quote must not survive unescaped
      expect(sql).not.toContain('"evil"; DROP TABLE users');
    });

    it('escapes a malicious table name in checkSeedExecuted and recordSeedExecution', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0 });
      const bad = 'evil"; DROP TABLE users; --';
      // @ts-expect-error - partial mock
      await checkSeedExecuted(mockClient, 'seed1', bad);
      // @ts-expect-error - partial mock
      await recordSeedExecution(mockClient, 'seed1', bad);
      expect(mockQuery.mock.calls[0][0]).toContain('"evil""; DROP TABLE users; --"');
      expect(mockQuery.mock.calls[1][0]).toContain('"evil""; DROP TABLE users; --"');
    });
  });
});
