import { describe, expect, it } from 'vitest';
import { formatCell } from './format';
import type { TableColumnConfig } from './types';

const LOCALE = 'en';

describe('formatCell', () => {
  it('returns an empty string for null', () => {
    const column: TableColumnConfig = { key: 'v', label: 'V', dataType: 'string' };
    expect(formatCell(null, column, LOCALE)).toBe('');
  });

  it('returns an empty string for undefined', () => {
    const column: TableColumnConfig = { key: 'v', label: 'V', dataType: 'string' };
    expect(formatCell(undefined, column, LOCALE)).toBe('');
  });

  it('resolves a matching option to its label', () => {
    const column: TableColumnConfig = {
      key: 'status',
      label: 'Status',
      dataType: 'string',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
      ],
    };
    expect(formatCell('active', column, LOCALE)).toBe('Active');
  });

  it('falls back to String(value) when no option matches', () => {
    const column: TableColumnConfig = {
      key: 'status',
      label: 'Status',
      dataType: 'string',
      options: [{ value: 'active', label: 'Active' }],
    };
    expect(formatCell('unknown', column, LOCALE)).toBe('unknown');
  });

  it('formats integer with thousands separators and no decimals', () => {
    const column: TableColumnConfig = { key: 'n', label: 'N', dataType: 'numeric', format: 'integer' };
    expect(formatCell(12345.6, column, LOCALE)).toBe('12,346');
  });

  it('formats decimal with exactly two fraction digits', () => {
    const column: TableColumnConfig = { key: 'n', label: 'N', dataType: 'numeric', format: 'decimal' };
    expect(formatCell(12345.6, column, LOCALE)).toBe('12,345.60');
  });

  it('formats percent', () => {
    const column: TableColumnConfig = { key: 'n', label: 'N', dataType: 'numeric', format: 'percent' };
    expect(formatCell(0.15, column, LOCALE)).toBe('15%');
  });

  it('formats currency in USD style', () => {
    const column: TableColumnConfig = { key: 'n', label: 'N', dataType: 'numeric', format: 'currency' };
    const result = formatCell(1234.5, column, LOCALE);
    expect(result).toContain('$');
  });

  it('formats date with year and month abbreviation present', () => {
    const column: TableColumnConfig = { key: 'd', label: 'D', dataType: 'date', format: 'date' };
    const result = formatCell('2024-03-15T00:00:00Z', column, 'en-US');
    expect(result).toContain('2024');
    expect(result).toMatch(/Mar/);
  });

  it('formats datetime with year, month abbreviation, and time', () => {
    const column: TableColumnConfig = { key: 'd', label: 'D', dataType: 'date', format: 'datetime' };
    const result = formatCell('2024-03-15T14:30:00Z', column, 'en-US');
    expect(result).toContain('2024');
    expect(result).toMatch(/Mar/);
  });

  it('formats time using timeStyle short', () => {
    const column: TableColumnConfig = { key: 'd', label: 'D', dataType: 'date', format: 'time' };
    const result = formatCell('2024-03-15T14:30:00Z', column, 'en-US');
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toContain('2024');
  });

  it('returns the original string for an invalid date', () => {
    const column: TableColumnConfig = { key: 'd', label: 'D', dataType: 'date', format: 'date' };
    expect(formatCell('not-a-date', column, LOCALE)).toBe('not-a-date');
  });

  it('returns String(value) when no format is set', () => {
    const column: TableColumnConfig = { key: 'v', label: 'V', dataType: 'string' };
    expect(formatCell(42, column, LOCALE)).toBe('42');
  });
});
