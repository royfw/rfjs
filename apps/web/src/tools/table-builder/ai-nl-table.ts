import { parseTableConfig } from "@rfjs/table-builder";
import type { TableConfig } from "@rfjs/table-builder";

/**
 * NL→TableConfig (design spec §2.3). Unlike form-builder's generate (which creates fields from
 * nothing), table columns map to real data fields — so the prompt embeds the CURRENT config and
 * pins the column key set: the model may only adjust display properties, order, and visibility.
 */
export function buildNlTablePrompt(nl: string, config: TableConfig): { system: string; user: string } {
  const system = [
    "You edit a table display config (TableConfig) as JSON ONLY, shape:",
    '{"columns":[{"key":"<field key>","label":"<string or {locale: string}>","dataType":"string|numeric|date|boolean",',
    '"format":"integer|decimal|percent|currency|date|datetime|time"?,"options":[{"value":...,"label":...}]?,',
    '"sortable":bool?,"filterable":bool?,"visible":bool?,"pin":"left"|"right"?,"align":"left"|"center"|"right"?}],',
    '"pagination":{"pageSize":<positive int>,"pageSizeOptions":[<int>]?},',
    '"defaultSort":{"key":"...","direction":"asc"|"desc"}?,"emptyText":"..."?}',
    "format compatibility: integer/decimal/percent/currency require dataType numeric; date/datetime/time require dataType date; string/boolean take no format.",
    "Current config:",
    JSON.stringify(config, null, 2),
    "Apply the user's request to this config and return the FULL modified TableConfig JSON (not a patch).",
    "Column keys map to data fields: never add or remove a key. Reorder columns or set visible:false to hide instead.",
    "Output the JSON object only.",
  ].join("\n");
  return { system, user: nl };
}

/** Ask about the current table config (mirrors form-builder's ai-explain-form shape). */
export function buildTableAskPrompt(
  ctx: { configJson: string; locale: string },
  question: string,
): { system: string; user: string } {
  const system = [
    "You are an assistant for a table display designer (TableConfig JSON: columns with formats, sorting, filtering, pagination).",
    "Current table config (JSON):",
    ctx.configJson,
    `Answer in the "${ctx.locale}" language, in plain text (no Markdown), concisely.`,
  ].join("\n");
  return { system, user: question };
}

/** Validation gate: strip an optional code fence, JSON.parse, then run the real zod parser — throws on invalid. */
export function parseNlTableResponse(raw: string): string {
  const text = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/, "")
    .trim();
  const config = parseTableConfig(JSON.parse(text));
  return JSON.stringify(config, null, 2);
}
