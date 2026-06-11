import jsonata from 'jsonata';
import { DataExprError } from './errors';
import type { CompiledExpr, ExprOptions } from './types';

/**
 * Parse an expression once and return a reusable evaluator.
 * Throws DataExprError(kind 'compile') synchronously on a malformed expression.
 */
export function compile(expression: string, options: ExprOptions = {}): CompiledExpr {
  void options; // consumed in later tasks (guards, strict/onUndefined)
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

  return {
    async evaluate(data: unknown): Promise<unknown> {
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
