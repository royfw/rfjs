import { inferSchema } from "@rfjs/filter-builder";
import type { FieldSchema } from "@rfjs/filter-builder";

export function parseRows(text: string): unknown[] {
  try {
    const data: unknown = JSON.parse(text);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function safeInfer(text: string): { schema: FieldSchema[]; error: string | null } {
  try {
    return { schema: inferSchema(JSON.parse(text)), error: null };
  } catch {
    return { schema: [], error: "invalidJson" };
  }
}

export function coerceCell(v: string): unknown {
  const t = v.trim();
  if (t === "") return "";
  if (t === "true") return true;
  if (t === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  return t;
}

// Minimal CSV parser (header row + quoted-field handling) -> array of objects.
export function parseCsv(text: string): unknown[] {
  const lines = text
    .replace(/\r\n/g, "\n")
    .trim()
    .split("\n")
    .filter(Boolean);
  if (lines.length < 2) return [];
  const cells = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) {
        if (c === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (c === '"') q = false;
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === ",") {
        out.push(cur);
        cur = "";
      } else cur += c;
    }
    out.push(cur);
    return out;
  };
  const headers = cells(lines[0] ?? "").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cs = cells(line);
    const row: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      row[h] = coerceCell(cs[i] ?? "");
    });
    return row;
  });
}
