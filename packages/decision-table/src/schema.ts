import { z } from 'zod';
import type { BuilderGroup } from '@rfjs/filter-builder';

import type { DecisionTable } from './types';

const LOGIC_OPS = new Set(['and', 'or', 'nor', 'not']);

/** 結構性檢查:是否為 BuilderGroup 的殼(不深驗 children 內容)。 */
export function isGroupShell(v: unknown): v is BuilderGroup {
  if (typeof v !== 'object' || v === null) return false;
  const g = v as Record<string, unknown>;
  return (
    g.kind === 'group' &&
    typeof g.id === 'string' &&
    g.id.length > 0 &&
    typeof g.logic === 'string' &&
    LOGIC_OPS.has(g.logic) &&
    Array.isArray(g.children)
  );
}

const builderGroupSchema = z.custom<BuilderGroup>(isGroupShell, 'invalid builder group');

const outputDefSchema = z.object({
  key: z.string().min(1),
  label: z.string().optional(),
});

const ruleSchema = z.object({
  id: z.string().min(1),
  description: z.string().optional(),
  when: builderGroupSchema,
  outputs: z.record(z.string(), z.unknown()),
});

// v1 looseness (deliberate): only validates "array or undefined" — structural, not deep;
// elements are not checked against FieldSchema.
const inputsSchema = z.custom<DecisionTable['inputs']>(
  (v) => v === undefined || Array.isArray(v),
  'inputs must be undefined or an array'
).optional();

export const decisionTableSchema: z.ZodType<DecisionTable> = z
  .object({
    version: z.literal(1),
    name: z.string().optional(),
    inputs: inputsSchema,
    outputs: z.array(outputDefSchema).min(1),
    hitPolicy: z.enum(['first', 'collect']),
    rules: z.array(ruleSchema),
    defaultOutputs: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((t) => new Set(t.rules.map((r) => r.id)).size === t.rules.length, {
    message: 'duplicated rule id',
    path: ['rules'],
  }) as z.ZodType<DecisionTable>;

export function parseTable(json: string): DecisionTable {
  return decisionTableSchema.parse(JSON.parse(json));
}

export function tableToJson(table: DecisionTable): string {
  return JSON.stringify(table, null, 2);
}
