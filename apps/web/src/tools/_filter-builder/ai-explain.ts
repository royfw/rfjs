import type { FieldSchema } from "@rfjs/filter-builder";

export interface ExplainContext {
  canonicalJson: string;
  schema: FieldSchema[];
  compiled: string | null;
  engineId: string;
  locale: string;
  /** 工具頁目前的樣本資料;prompt 只帶前 AI_SAMPLE_LIMIT 筆 + 總筆數。 */
  sampleRows?: unknown[];
}

/** 帶進 prompt 的樣本上限(資料送往使用者自己的端點,上限只是控 token)。 */
export const AI_SAMPLE_LIMIT = 5;

/** 樣本段落:前 N 筆 + 總數;無資料回空陣列(不佔 prompt)。 */
export function sampleSection(rows: unknown[] | undefined): string[] {
  if (!rows || rows.length === 0) return [];
  return [
    `Sample data (first ${Math.min(rows.length, AI_SAMPLE_LIMIT)} of ${rows.length} rows):`,
    JSON.stringify(rows.slice(0, AI_SAMPLE_LIMIT)),
  ];
}

/** 解釋/問答共用的 system context(display-only,回覆純文字,不需 JSON 模式)。 */
function buildSystem(ctx: ExplainContext): string {
  const fields = ctx.schema
    .map((f) => `- ${f.path} (${f.dataType}${f.elementType ? `<${f.elementType}>` : ""})`)
    .join("\n");
  return [
    `You are an assistant for a ${ctx.engineId} filter builder.`,
    "The user's field definitions:",
    fields,
    ...sampleSection(ctx.sampleRows),
    "Current filter tree (canonical JSON):",
    ctx.canonicalJson,
    `Compiled output: ${ctx.compiled ?? "(none)"}`,
    `Answer in the "${ctx.locale}" language, in plain text (no Markdown), concisely.`,
  ].join("\n");
}

export function buildExplainPrompt(ctx: ExplainContext): { system: string; user: string } {
  return {
    system: buildSystem(ctx),
    user: "Explain what data this filter selects. If the tree is empty, say there are no conditions yet.",
  };
}

export function buildAskPrompt(ctx: ExplainContext, question: string): { system: string; user: string } {
  return { system: buildSystem(ctx), user: question };
}
