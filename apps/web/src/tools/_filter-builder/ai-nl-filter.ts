import { parseFilterGroup, type FieldSchema } from "@rfjs/filter-builder";

/** NL→條件樹的 prompt。輸出目標是 canonical FilterGroup JSON(不含 id 的簡單形狀)。
 * 帶入 currentJson 時,描述可以是「接續/修改」既有條件 —— AI 一律回傳合併後的完整樹。 */
export function buildNlFilterPrompt(
  nl: string,
  schema: FieldSchema[],
  currentJson?: string,
): { system: string; user: string } {
  const fields = schema
    .map((f) => `- ${f.path} (${f.dataType}${f.elementType ? `<${f.elementType}>` : ""})`)
    .join("\n");
  const hasCurrent = Boolean(currentJson && currentJson.trim() !== "");
  const system = [
    "You convert a natural-language description into a canonical filter group as JSON.",
    'Output ONLY a JSON object of shape: {"logic":"and|or|nor|not","filters":[<condition|group>...]}.',
    'A condition is {"field":"<path>","dataType":"<type>","operator":"<op>","value":<value>}.',
    "dataType MUST match the field's type from the field list below exactly. Groups nest recursively.",
    "Common operators: eq, ne, gt, gte, lt, lte, in, nin, like, exists, elemmatch.",
    "Use ONLY these fields:",
    fields,
    ...(hasCurrent
      ? [
          "Current filter tree (canonical JSON):",
          currentJson as string,
          "The description may be a brand-new filter, an ADDITION to the current tree (e.g. starting with 且/而且/也/and/also), or a MODIFICATION of an existing condition.",
          "ALWAYS return the COMPLETE resulting filter group: when adding or modifying, keep every other existing condition and combine with the appropriate logic (nest groups when mixing and/or); only when the description clearly stands alone as a new filter may you replace the tree.",
        ]
      : []),
    'Example: {"logic":"and","filters":[{"field":"amount","dataType":"numeric","operator":"gt","value":100},' +
      '{"logic":"or","filters":[{"field":"dept","dataType":"string","operator":"eq","value":"Engineering"},' +
      '{"field":"dept","dataType":"string","operator":"eq","value":"Product"}]}]}',
  ].join("\n");
  return { system, user: nl };
}

/** 驗證閘門:非 JSON / 非合法 filter group 一律 throw;通過回傳 pretty JSON(交給 onCanonicalChange)。 */
export function parseNlFilterResponse(raw: string): string {
  const parsed: unknown = JSON.parse(raw); // SyntaxError 自然上拋
  const text = JSON.stringify(parsed, null, 2);
  const r = parseFilterGroup(text);
  if (!r.ok) {
    const reason =
      r.error === "invalidJson" ? "the AI response is not valid JSON" : "the AI response is not a valid filter group";
    throw new Error(reason);
  }
  return text;
}
