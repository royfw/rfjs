import { getByPath } from './path';
import type { ResponseMeta } from './types';

export function extractRows(payload: unknown, response: ResponseMeta): unknown[] {
  const value = getByPath(payload, response.rowsPath);
  if (!Array.isArray(value)) {
    throw new Error(`extractRows: expected an array at path "${response.rowsPath}"`);
  }
  return value;
}

export function extractTotal(payload: unknown, response: ResponseMeta): number | undefined {
  if (response.totalPath === undefined) return undefined;
  const value = getByPath(payload, response.totalPath);
  return typeof value === 'number' ? value : undefined;
}

export function extractCursor(payload: unknown, response: ResponseMeta): string | undefined {
  if (response.cursorPath === undefined) return undefined;
  const value = getByPath(payload, response.cursorPath);
  return typeof value === 'string' ? value : undefined;
}
