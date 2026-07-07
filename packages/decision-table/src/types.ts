import type { BuilderGroup, FieldSchema } from '@rfjs/filter-builder';

export type HitPolicy = 'first' | 'collect';

export interface DecisionOutputDef {
  /** 輸出欄 key(outputs record 中的鍵)。 */
  key: string;
  label?: string;
}

export interface DecisionRule {
  id: string;
  description?: string;
  /** filter-builder 條件樹「原樣內嵌」(任意巢狀 and/or/nor/not + elemmatch)。 */
  when: BuilderGroup;
  /** 輸出值:常值直接用;字串以 "=" 前綴 → data-expr 對 context 運算。 */
  outputs: Record<string, unknown>;
}

export interface DecisionTable {
  version: 1;
  name?: string;
  /** 欄位定義(給編輯器用;沿用 filter-builder 的 FieldSchema)。 */
  inputs?: FieldSchema[];
  outputs: DecisionOutputDef[];
  hitPolicy: HitPolicy;
  /** 有序:由上而下評估。 */
  rules: DecisionRule[];
  /** 無命中時的 else 輸出(可選;值同樣支援 "=" 表達式)。 */
  defaultOutputs?: Record<string, unknown>;
}
