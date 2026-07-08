export interface FormExplainContext {
  configJson: string;
  locale: string;
}

function buildSystem(ctx: FormExplainContext): string {
  return [
    "You are an assistant for a form designer (FormConfig JSON: sections/fields with components and validation).",
    "Current form config (JSON):",
    ctx.configJson,
    `Answer in the "${ctx.locale}" language, in plain text (no Markdown), concisely.`,
  ].join("\n");
}

export function buildFormExplainPrompt(ctx: FormExplainContext): { system: string; user: string } {
  return { system: buildSystem(ctx), user: "Explain what this form collects and any validation rules, briefly." };
}

export function buildFormAskPrompt(ctx: FormExplainContext, question: string): { system: string; user: string } {
  return { system: buildSystem(ctx), user: question };
}
