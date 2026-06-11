export type DataExprErrorKind =
  | 'compile'   // the expression string failed to parse
  | 'evaluate'  // evaluation threw (type errors, bad function args, …)
  | 'timeout'   // the per-evaluate wall-clock budget was exceeded
  | 'depth'     // the evaluation-depth budget was exceeded
  | 'undefined'; // strict mode: the expression evaluated to undefined

/** Typed error for every failure surfaced by @rfjs/data-expr. */
export class DataExprError extends Error {
  readonly kind: DataExprErrorKind;
  /** The original expression string (without any '=' slot prefix). */
  readonly expression: string;

  constructor(
    kind: DataExprErrorKind,
    expression: string,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'DataExprError';
    this.kind = kind;
    this.expression = expression;
  }
}
