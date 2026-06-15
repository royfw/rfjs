export type ColumnQueryErrorCode =
  | 'UNKNOWN_COLUMN'
  | 'UNSUPPORTED_OPERATOR'
  | 'INVALID_VALUE'
  | 'INVALID_SORT'
  | 'INVALID_PARAM_OFFSET';

export class ColumnQueryError extends Error {
  constructor(
    message: string,
    readonly code: ColumnQueryErrorCode,
  ) {
    super(message);
    this.name = 'ColumnQueryError';
  }
}
