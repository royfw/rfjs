import jsonata from 'jsonata';
import { DataExprError } from './errors';
import type { CompiledExpr, ExprOptions } from './types';

const DEFAULT_TIMEOUT_MS = 1000;
const DEFAULT_MAX_DEPTH = 100;

// jsonata ≥2 looks the evaluation hooks up by these Symbols — assigning by
// the string names ('__evaluate_entry') is silently ignored (verified 2.2.1).
const EVALUATE_ENTRY = Symbol.for('jsonata.__evaluate_entry');
const EVALUATE_EXIT = Symbol.for('jsonata.__evaluate_exit');

/**
 * Parse an expression once and return a reusable evaluator. The timeout/depth
 * budget is wired into jsonata's entry/exit hooks and RESET at the start of
 * each evaluate() call, so compiled expressions are reusable (sequentially —
 * see CompiledExpr.evaluate).
 * Throws DataExprError(kind 'compile') synchronously on a malformed expression.
 */
export function compile(expression: string, options: ExprOptions = {}): CompiledExpr {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, maxDepth = DEFAULT_MAX_DEPTH } = options;

  let parsed: jsonata.Expression;
  try {
    parsed = jsonata(expression);
  } catch (cause) {
    throw new DataExprError(
      'compile',
      expression,
      `invalid expression: ${(cause as Error).message}`,
      { cause },
    );
  }

  let startedAt = 0;
  let depth = 0;
  const checkBudget = (): void => {
    if (depth > maxDepth) {
      throw new DataExprError('depth', expression, `max evaluation depth ${maxDepth} exceeded`);
    }
    if (Date.now() - startedAt > timeoutMs) {
      throw new DataExprError('timeout', expression, `evaluation timed out after ${timeoutMs}ms`);
    }
  };
  // The jsonata type definitions only accept string keys for assign(); the
  // runtime accepts Symbols (and ONLY honors Symbols for these hooks).
  parsed.assign(EVALUATE_ENTRY as unknown as string, () => {
    depth += 1;
    checkBudget();
  });
  parsed.assign(EVALUATE_EXIT as unknown as string, () => {
    depth -= 1;
    checkBudget();
  });

  return {
    async evaluate(data: unknown): Promise<unknown> {
      startedAt = Date.now();
      depth = 0;
      try {
        const result = (await parsed.evaluate(data)) as unknown;
        // jsonata 2.x tags multi-element result arrays with an enumerable
        // `sequence: true` own property; strip it so consumers get plain arrays.
        if (Array.isArray(result) && Object.prototype.hasOwnProperty.call(result, 'sequence')) {
          Reflect.deleteProperty(result, 'sequence');
        }
        return result;
      } catch (cause) {
        if (cause instanceof DataExprError) throw cause;
        throw new DataExprError(
          'evaluate',
          expression,
          `evaluation failed: ${(cause as Error).message}`,
          { cause },
        );
      }
    },
  };
}

/** One-shot convenience (compile + evaluate). Not for hot paths — prefer compile(). */
export async function evaluate(
  expression: string,
  data: unknown,
  options?: ExprOptions,
): Promise<unknown> {
  return compile(expression, options).evaluate(data);
}
