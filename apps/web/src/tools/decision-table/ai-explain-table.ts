export interface TableExplainContext {
  tableJson: string;
  locale: string;
}

function buildSystem(ctx: TableExplainContext): string {
  return [
    "You are an assistant for a decision-table editor (rules evaluated top-down; conditions are nested filter trees).",
    "Current table (JSON):",
    ctx.tableJson,
    `Answer in the "${ctx.locale}" language, in plain text (no Markdown), concisely.`,
  ].join("\n");
}

export function buildTableExplainPrompt(ctx: TableExplainContext): { system: string; user: string } {
  return { system: buildSystem(ctx), user: "Explain what this decision table does, rule by rule, briefly." };
}

export function buildTableAskPrompt(ctx: TableExplainContext, question: string): { system: string; user: string } {
  return { system: buildSystem(ctx), user: question };
}
