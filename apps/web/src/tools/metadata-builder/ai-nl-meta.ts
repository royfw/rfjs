import { parseDataResourceMeta } from "@rfjs/data-schema";
import type { DataResourceMeta } from "@rfjs/data-schema";

/**
 * NL→DataResourceMeta(design spec §2)。generate 附上目前 meta:「調整」型請求基於現況、
 * 「新資源」型請求整份重來 —— 由使用者的自然語言決定;回傳一律是完整文件(不是 patch),
 * 交給 parseDataResourceMeta 驗證閘。
 */
export function buildNlMetaPrompt(nl: string, meta: DataResourceMeta): { system: string; user: string } {
  const system = [
    "You author a data resource metadata document (DataResourceMeta) as JSON ONLY, shape:",
    '{"fields":[{"key":"<dot.path>","label":"<string or {en, zh-TW}>","dataType":"string|numeric|date|boolean",',
    '"format":"integer|decimal|percent|currency|date|datetime|time"?,"options":[{"value":...,"label":...}]?,',
    '"sortable":bool?,"filterable":bool?,"kind":"column"|"jsonb"?}],',
    '"request":{"endpoint":"...","method":"GET"|"POST"?,"pagination":{...offset|page|cursor strategies...},',
    '"sort":{...}?,"filter":{"style":"pg","param":"..."}?}?,"response":{"rowsPath":"...","totalPath":"..."?,"cursorPath":"..."?}?}',
    "format compatibility: integer/decimal/percent/currency require dataType numeric; date/datetime/time require dataType date.",
    "kind semantics: how the backend queries the field — flat top-level columns lean 'column', nested dot-paths lean 'jsonb';",
    "follow the user's description when it says where a field lives. Omit kind when unsure.",
    "request/response are optional — omit anything the user did not describe. Bilingual labels ({en, zh-TW}) are welcome.",
    "Current document:",
    JSON.stringify(meta, null, 2),
    "Apply the user's request: either adjust the current document or author a new resource from scratch, as the request implies.",
    "Return the FULL resulting DataResourceMeta JSON (never a patch). Output the JSON object only.",
  ].join("\n");
  return { system, user: nl };
}

/** 詢問目前宣告(鏡射 ai-explain-form 的形狀)。 */
export function buildMetaAskPrompt(
  ctx: { metaJson: string; locale: string },
  question: string,
): { system: string; user: string } {
  const system = [
    "You are an assistant for a data-resource metadata designer (DataResourceMeta JSON: fields with kinds/formats/enums plus a request/response protocol).",
    "Current document (JSON):",
    ctx.metaJson,
    `Answer in the "${ctx.locale}" language, in plain text (no Markdown), concisely.`,
  ].join("\n");
  return { system, user: question };
}

/** 驗證閘:strip code fence → JSON.parse → parseDataResourceMeta(zod,失敗 throw)→ 正規化 JSON。 */
export function parseNlMetaResponse(raw: string): string {
  const text = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/, "")
    .trim();
  const meta = parseDataResourceMeta(JSON.parse(text));
  return JSON.stringify(meta, null, 2);
}
