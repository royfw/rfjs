export type PgFilterErrorCode = 'INVALID_TARGET' | 'INVALID_PAGINATION';

export class PgFilterError extends Error {
  constructor(
    message: string,
    readonly code: PgFilterErrorCode,
  ) {
    super(message);
    this.name = 'PgFilterError';
  }
}
