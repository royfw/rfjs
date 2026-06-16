import type { ElementType, FieldSchema, FieldType, ScalarType } from "./types";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?Z?)?)?$/;

function scalarOf(v: unknown): ScalarType {
  if (typeof v === "number") return "numeric";
  if (typeof v === "boolean") return "boolean";
  if (typeof v === "string" && ISO_DATE.test(v)) return "date";
  return "string";
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function elementTypeOf(arr: unknown[]): ElementType {
  const first = arr.find((x) => x !== null && x !== undefined);
  if (first === undefined) return "string"; // empty array defaults to string
  if (isPlainObject(first)) return "object";
  return scalarOf(first);
}

function fieldTypeOf(v: unknown): { dataType: FieldType; elementType?: ElementType } {
  if (Array.isArray(v)) return { dataType: "array", elementType: elementTypeOf(v) };
  if (isPlainObject(v)) return { dataType: "object" };
  return { dataType: scalarOf(v) };
}

// path -> first observed type signature; conflicts collapse to string
function walk(
  obj: Record<string, unknown>,
  prefix: string,
  acc: Map<string, { dataType: FieldType; elementType?: ElementType }>,
): void {
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    const inferred = fieldTypeOf(value);
    const prev = acc.get(path);
    if (prev && (prev.dataType !== inferred.dataType || prev.elementType !== inferred.elementType)) {
      acc.set(path, { dataType: "string" }); // conflict -> string
    } else if (!prev) {
      acc.set(path, inferred);
    }
    if (inferred.dataType === "object" && acc.get(path)?.dataType === "object") {
      walk(value as Record<string, unknown>, path, acc);
    }
  }
}

export function inferSchema(rows: unknown): FieldSchema[] {
  if (!Array.isArray(rows)) throw new Error("expected an array of objects");
  const acc = new Map<string, { dataType: FieldType; elementType?: ElementType }>();
  for (const row of rows) {
    if (!isPlainObject(row)) throw new Error("expected an array of objects");
    walk(row, "", acc);
  }
  // drop leaf paths orphaned under a non-object parent (heterogeneous data)
  for (const path of [...acc.keys()]) {
    const dot = path.lastIndexOf(".");
    if (dot === -1) continue;
    const parent = path.slice(0, dot);
    const parentEntry = acc.get(parent);
    if (parentEntry && parentEntry.dataType !== "object") acc.delete(path);
  }
  return [...acc.entries()].map(([path, t]) => ({
    path,
    dataType: t.dataType,
    ...(t.elementType ? { elementType: t.elementType } : {}),
    include: true,
    kind: "jsonb" as const,
  }));
}
