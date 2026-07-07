import type { DecisionTable } from "@rfjs/decision-table";
import type { BuilderGroup } from "@rfjs/filter-builder";

const g = (id: string, children: BuilderGroup["children"]): BuilderGroup => ({
  kind: "group",
  id,
  logic: "and",
  children,
});

/** 範例:簽核路由 —— 金額/部門 → 簽核人。含一列巢狀 AND 與一個 "=" 表達式輸出。 */
export const sampleTable: DecisionTable = {
  version: 1,
  name: "Approval routing",
  inputs: [
    { path: "amount", dataType: "numeric", include: true, kind: "jsonb" },
    { path: "dept", dataType: "string", include: true, kind: "jsonb" },
  ],
  outputs: [
    { key: "approver", label: "Approver" },
    { key: "note", label: "Note" },
  ],
  hitPolicy: "first",
  rules: [
    {
      id: "rule-cfo",
      description: "Big spend goes to the CFO",
      when: g("g-cfo", [
        { kind: "condition", id: "c-cfo", field: "amount", dataType: "numeric", operator: "gt", value: 100000 },
      ]),
      outputs: { approver: "CFO", note: "= \"amount \" & $string(amount)" },
    },
    {
      id: "rule-eng",
      description: "Mid-size engineering spend",
      when: g("g-eng", [
        { kind: "condition", id: "c-e1", field: "amount", dataType: "numeric", operator: "gt", value: 50000 },
        { kind: "condition", id: "c-e2", field: "dept", dataType: "string", operator: "eq", value: "Engineering" },
      ]),
      outputs: { approver: "VP Engineering", note: "escalated" },
    },
    {
      id: "rule-fin",
      description: "Finance requests",
      when: g("g-fin", [
        { kind: "condition", id: "c-f1", field: "dept", dataType: "string", operator: "eq", value: "Finance" },
      ]),
      outputs: { approver: "Finance Manager", note: "standard" },
    },
  ],
  defaultOutputs: { approver: "Direct Manager", note: "auto" },
};

/** 批次試算範例 rows。 */
export const sampleBatch: Record<string, unknown>[] = [
  { amount: 200000, dept: "Engineering" },
  { amount: 60000, dept: "Engineering" },
  { amount: 30000, dept: "Finance" },
  { amount: 500, dept: "HR" },
];
