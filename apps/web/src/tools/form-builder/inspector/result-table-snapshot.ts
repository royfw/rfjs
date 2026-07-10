import { deriveTableConfig, type TableConfig } from "@rfjs/table-builder";
import { inferFieldsFromRows } from "@rfjs/data-schema";

/**
 * Turn a pasted sample response into a TableConfig via infer→derive.
 * Accepts an array of row objects or a single object (wrapped to one row).
 * Pure and self-contained so it unit-tests without rendering.
 */
export function snapshotTableConfig(text: string): { config?: TableConfig; error?: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { error: "Invalid JSON" };
  }
  const rows = Array.isArray(parsed) ? parsed : [parsed];
  try {
    const fields = inferFieldsFromRows(rows);
    if (fields.length === 0) return { error: "No columns found in the sample" };
    return { config: deriveTableConfig({ fields }) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not read the sample" };
  }
}
