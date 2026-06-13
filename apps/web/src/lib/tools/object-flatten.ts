import { flatten } from "@rfjs/object-utils";

export type FlattenResult =
  | { ok: true; output: string }
  | { ok: false; error: "invalidJson" | "notObject" };

export function flattenJson(text: string): FlattenResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "invalidJson" };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "notObject" };
  }
  return { ok: true, output: JSON.stringify(flatten(parsed as object), null, 2) };
}
