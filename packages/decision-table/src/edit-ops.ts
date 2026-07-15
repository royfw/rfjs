import { emptyGroup } from '@rfjs/filter-builder';

import type { DecisionRule, DecisionTable } from './types';

/** 全新空表:一個輸出欄、first、無規則。 */
export function emptyTable(): DecisionTable {
  return {
    version: 1,
    outputs: [{ key: 'result' }],
    hitPolicy: 'first',
    rules: [],
  };
}

/** 新規則:空的 and 群組 + 空輸出。 */
export function newRule(id: () => string): DecisionRule {
  return { id: id(), when: emptyGroup(id), outputs: {} };
}

/** 移動規則(immutable);索引越界時原樣返回。 */
export function moveRule(table: DecisionTable, from: number, to: number): DecisionTable {
  const n = table.rules.length;
  if (from < 0 || from >= n || to < 0 || to >= n || from === to) return table;
  const rules = [...table.rules];
  const [moved] = rules.splice(from, 1);
  rules.splice(to, 0, moved!);
  return { ...table, rules };
}
