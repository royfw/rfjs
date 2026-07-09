import type { DataFieldMeta, ScalarType } from './types';

// Matches YYYY-MM-DD with an optional time-of-day suffix; combined with the
// Date.parse guard below so obviously-non-date strings never get flagged as dates.
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T.*)?$/;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

function scalarOf(v: string | number | boolean): ScalarType {
  if (typeof v === 'number') return 'numeric';
  if (typeof v === 'boolean') return 'boolean';
  if (ISO_DATE_RE.test(v) && !Number.isNaN(Date.parse(v))) return 'date';
  return 'string';
}

function walk(obj: Record<string, unknown>, prefix: string, acc: Map<string, ScalarType>): void {
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;
    const path = prefix ? `${prefix}.${key}` : key;

    // Objects and arrays never produce a field themselves; only scalar leaves do.
    if (Array.isArray(value)) continue;
    if (isPlainObject(value)) {
      walk(value, path, acc);
      continue;
    }

    const inferred = scalarOf(value as string | number | boolean);
    const prev = acc.get(path);
    if (prev === undefined) {
      acc.set(path, inferred);
    } else if (prev !== inferred) {
      // cross-row type conflict falls back to string
      acc.set(path, 'string');
    }
  }
}

export function inferFieldsFromRows(rows: unknown): DataFieldMeta[] {
  if (!Array.isArray(rows)) {
    throw new Error('inferFieldsFromRows: expected rows to be an array');
  }

  const fieldTypes = new Map<string, ScalarType>();
  for (const row of rows) {
    if (!isPlainObject(row)) {
      throw new Error('inferFieldsFromRows: expected each row to be a plain object');
    }
    walk(row, '', fieldTypes);
  }

  return [...fieldTypes.entries()].map(([key, dataType]) => ({ key, label: key, dataType }));
}
