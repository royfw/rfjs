import Papa from "papaparse";

export type ImportFormat = "json" | "csv";
export type ImportResult = { rows: Record<string, unknown>[] } | { error: string };

export function parseImport(text: string, format: ImportFormat): ImportResult {
  if (format === "json") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { error: "Invalid JSON." };
    }
    if (!Array.isArray(parsed) || !parsed.every((r) => r !== null && typeof r === "object" && !Array.isArray(r))) {
      return { error: "JSON must be an array of objects." };
    }
    return { rows: parsed as Record<string, unknown>[] };
  }
  const out = Papa.parse<Record<string, unknown>>(text.trim(), { header: true, dynamicTyping: true, skipEmptyLines: true });
  if (out.errors.length > 0) return { error: out.errors[0]!.message };
  if (out.data.length === 0) return { error: "No rows found in CSV." };
  return { rows: out.data };
}
