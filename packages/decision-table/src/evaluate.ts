import { runLiveMatch } from '@rfjs/filter-builder';
import { evaluate as evaluateExpr, isExpression, stripExpressionPrefix } from '@rfjs/data-expr';

import { decisionTableSchema } from './schema';
import type { DecisionRule, DecisionTable, HitPolicy } from './types';

export interface RuleError {
  ruleId: string;
  kind: 'uncoverable' | 'expression';
  message: string;
}

export class DecisionTableError extends Error {
  constructor(public readonly errors: RuleError[]) {
    super(errors.map((e) => `[${e.kind}] rule "${e.ruleId}": ${e.message}`).join('; '));
    this.name = 'DecisionTableError';
  }
}

export interface EvaluateOptions {
  /** true 時任一 uncoverable / expression 錯誤立即 throw DecisionTableError。 */
  strict?: boolean;
}

export interface EvaluateResult {
  hitPolicy: HitPolicy;
  /** 命中的 ruleId(依表內順序;first 至多 1 個)。 */
  matched: string[];
  /** first → Record | null;collect → Record[](default → 單元素陣列)。 */
  outputs: Record<string, unknown> | Record<string, unknown>[] | null;
  usedDefault: boolean;
  /** 不得靜默:呼叫端/UI 必須呈現。
   * first 策略下評估短路於首次命中,故 ruleErrors 僅反映該時點前檢視的規則;
   * 空陣列不保證整張表無誤。 */
  ruleErrors: RuleError[];
}

export async function evaluateTable(
  table: DecisionTable,
  context: unknown,
  opts?: EvaluateOptions,
): Promise<EvaluateResult> {
  const parsed = decisionTableSchema.parse(table); // 邊界驗證,invalid 即 throw
  const ruleErrors: RuleError[] = [];

  const fail = (err: RuleError): void => {
    ruleErrors.push(err);
    if (opts?.strict) throw new DecisionTableError([err]);
  };

  // 逐列命中判斷(有序)。
  const matchedRules: DecisionRule[] = [];
  for (const rule of parsed.rules) {
    const res = runLiveMatch([context], rule.when);
    if (res.uncoverable) {
      fail({
        ruleId: rule.id,
        kind: 'uncoverable',
        message: 'condition could not be evaluated in memory',
      });
      continue;
    }
    if (res.count === 1) {
      matchedRules.push(rule);
      if (parsed.hitPolicy === 'first') break;
    }
  }

  // 輸出解析:常值原樣;"=" 前綴走 data-expr(循序 await —— CompiledExpr 不可併發)。
  const resolveOutputs = async (ruleId: string, outputs: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const resolved: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(outputs)) {
      if (typeof value === 'string' && isExpression(value)) {
        try {
          resolved[key] = await evaluateExpr(stripExpressionPrefix(value), context);
        } catch (e) {
          resolved[key] = undefined;
          fail({
            ruleId,
            kind: 'expression',
            message: `output "${key}": ${e instanceof Error ? e.message : String(e)}`,
          });
        }
      } else {
        resolved[key] = value;
      }
    }
    return resolved;
  };

  let outputs: EvaluateResult['outputs'];
  let usedDefault = false;

  if (matchedRules.length > 0) {
    if (parsed.hitPolicy === 'first') {
      const first = matchedRules[0]!;
      outputs = await resolveOutputs(first.id, first.outputs);
    } else {
      const collected: Record<string, unknown>[] = [];
      for (const rule of matchedRules) collected.push(await resolveOutputs(rule.id, rule.outputs));
      outputs = collected;
    }
  } else if (parsed.defaultOutputs) {
    usedDefault = true;
    const resolved = await resolveOutputs('__default__', parsed.defaultOutputs);
    outputs = parsed.hitPolicy === 'first' ? resolved : [resolved];
  } else {
    outputs = parsed.hitPolicy === 'first' ? null : [];
  }

  return {
    hitPolicy: parsed.hitPolicy,
    matched: matchedRules.map((r) => r.id),
    outputs,
    usedDefault,
    ruleErrors,
  };
}
