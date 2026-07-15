import type { EsDialect } from './types';

export class EsQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EsQueryError';
  }
}

export class UnsupportedClauseError extends EsQueryError {
  constructor(
    public readonly clause: string,
    public readonly dialect: EsDialect,
  ) {
    super(`Clause "${clause}" is not supported by dialect "${dialect}"`);
    this.name = 'UnsupportedClauseError';
  }
}
