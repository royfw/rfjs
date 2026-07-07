import { z } from "zod";

const findingSchema = z.object({
  kind: z.enum(["gap", "overlap", "unreachable", "note"]),
  ruleIds: z.array(z.string()),
  message: z.string().min(1),
});
const responseSchema = z.object({ findings: z.array(findingSchema) });

export type AiFinding = z.infer<typeof findingSchema>;

/** AI 表格檢查的 prompt——輸出目標是 findings-only JSON。 */
export function buildCheckPrompt(tableJson: string, locale: string): { system: string; user: string } {
  const system = [
    "You review a decision table (rules evaluated top-down; conditions are nested filter trees).",
    'Report findings as JSON ONLY: {"findings":[{"kind":"gap|overlap|unreachable|note","ruleIds":["<id>"],"message":"..."}]}.',
    "kinds: gap = input regions no rule covers; overlap = rules that can match the same input;",
    "unreachable = a rule an earlier rule always shadows; note = anything else worth knowing.",
    `Write every message in the "${locale}" language. Reference rules by their id.`,
  ].join("\n");
  return { system, user: tableJson };
}

/** 驗證閘門 + 幻覺過濾:未知 ruleId 移除(finding 本身保留)。非法 JSON/shape 一律 throw。 */
export function parseCheckResponse(raw: string, validRuleIds: string[]): AiFinding[] {
  const parsed = responseSchema.parse(JSON.parse(raw));
  const valid = new Set(validRuleIds);
  return parsed.findings.map((f) => ({ ...f, ruleIds: f.ruleIds.filter((id) => valid.has(id)) }));
}
