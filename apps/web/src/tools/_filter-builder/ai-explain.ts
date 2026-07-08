import type { FieldSchema } from "@rfjs/filter-builder";

export interface ExplainContext {
  canonicalJson: string;
  schema: FieldSchema[];
  compiled: string | null;
  engineId: string;
  locale: string;
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
