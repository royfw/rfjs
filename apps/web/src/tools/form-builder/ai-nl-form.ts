import { jsonToCards } from "./model";

/** NL→FormConfig. Outputs the v1 simplified shape (fields[]), handed to the existing jsonToCards import. */
export function buildNlFormPrompt(nl: string): { system: string; user: string } {
  const system = [
    "You design a form config as JSON ONLY, shape:",
    '{"version":1,"fields":[{"key":"<snake_or_camel>","label":"<label>","component":"<Component>","dataType":"<type>","required":<bool>?}]}',
    "Allowed component/dataType pairs: Input/string, Textarea/string, Number/numeric, Email/string,",
    "Switch/boolean, Checkbox/boolean, Radio/string, Select/string, DatePicker/date.",
    'Radio/Select need "options":[{"label":"...","value":"..."}].',
    "Keep it minimal and practical. Output the JSON object only.",
  ].join("\n");
  return { system, user: nl };
}

/** Validation gate: jsonToCards (which runs parseFormConfig) does a trial conversion; throws on invalid. */
export function parseNlFormResponse(raw: string): string {
  const text = JSON.stringify(JSON.parse(raw), null, 2);
  jsonToCards(text); // throws on invalid
  return text;
}
