export interface CompiledExpr {
  /**
   * Evaluate against a data object. Async (jsonata v2 returns a Promise).
   * NOT safe for CONCURRENT calls on the same instance — the timebox budget
   * is per-instance and resets at the start of each call; sequential reuse
   * (compile once, evaluate row by row) is the supported contract.
   */
  evaluate(data: unknown): Promise<unknown>;
}

export interface ExprOptions {
  /** Wall-clock budget per evaluate() call, in ms. Default 1000. */
  timeoutMs?: number;
  /** Evaluation-depth budget (recursion guard). Default 100. */
  maxDepth?: number;
  /** When true, an undefined result rejects (kind 'undefined') instead of resolving undefined. */
  strict?: boolean;
  /** Observability hook fired whenever a result is undefined. */
  onUndefined?: (expression: string) => void;
}
