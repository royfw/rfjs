import { resolveLabel } from '@rfjs/data-schema';
import type { TableColumnConfig } from './types';

function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  return new Date(String(value));
}

function formatNumeric(value: unknown, format: 'integer' | 'decimal' | 'percent' | 'currency', locale: string): string {
  const n = Number(value);
  switch (format) {
    case 'integer':
      return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(n);
    case 'decimal':
      return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
    case 'percent':
      return new Intl.NumberFormat(locale, { style: 'percent' }).format(n);
    case 'currency':
      // Currency is fixed to USD for now; parameterizing the currency code is future work (spec §8.4).
      return new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(n);
  }
}

function formatDate(value: unknown, format: 'date' | 'datetime' | 'time', locale: string): string {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const options: Intl.DateTimeFormatOptions =
    format === 'date' ? { dateStyle: 'medium' } : format === 'datetime' ? { dateStyle: 'medium', timeStyle: 'short' } : { timeStyle: 'short' };
  return new Intl.DateTimeFormat(locale, options).format(date);
}

// Renders a raw cell value as a display string for a given column config.
// Precedence: null/undefined -> ''; options (value -> label) lookup wins over format when present
// (miss falls back to String(value)); otherwise dataType-appropriate Intl formatting per
// `column.format`; with no format at all, String(value).
export function formatCell(value: unknown, column: TableColumnConfig, locale = 'en'): string {
  if (value === null || value === undefined) return '';

  if (column.options !== undefined) {
    const match = column.options.find((option) => option.value === value);
    if (match !== undefined) return resolveLabel(match.label, locale);
    return String(value);
  }

  if (column.format === undefined) return String(value);

  switch (column.format) {
    case 'integer':
    case 'decimal':
    case 'percent':
    case 'currency':
      return formatNumeric(value, column.format, locale);
    case 'date':
    case 'datetime':
    case 'time':
      return formatDate(value, column.format, locale);
    default:
      return String(value);
  }
}
