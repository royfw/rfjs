import { PgFilterError } from './errors';

export function computeLimitOffset(input: { page?: number; pageSize?: number }): {
  limit?: number;
  offset?: number;
} {
  const page = input.page ?? 1;
  if (!Number.isInteger(page) || page < 1) {
    throw new PgFilterError(`Invalid page: ${String(input.page)}`, 'INVALID_PAGINATION');
  }
  if (input.pageSize === undefined) return {};
  const { pageSize } = input;
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new PgFilterError(`Invalid pageSize: ${String(pageSize)}`, 'INVALID_PAGINATION');
  }
  return { limit: pageSize, offset: (page - 1) * pageSize };
}
