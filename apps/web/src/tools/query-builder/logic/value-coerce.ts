import type { OperatorArity } from "./engines/types";
import type { FieldType } from "./types";

function coerceScalar(dataType: string, raw: string): string | number | boolean {
  if (dataType === "numeric") {
    const n = Number(raw);
    return raw.trim() !== "" && !Number.isNaN(n) ? n : raw;
  }
  if (dataType === "boolean") return raw.trim().toLowerCase() === "true";
  return raw; // string / date stay strings
}

function splitList(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function coerceInput(
  dataType: FieldType | string,
  arity: OperatorArity,
  raw: string,
): unknown {
  if (arity === "none") return undefined;
  if (arity === "list") return splitList(raw).map((s) => coerceScalar(dataType, s));
  if (arity === "two") {
    const [a, b] = splitList(raw);
    return [coerceScalar(dataType, a ?? ""), coerceScalar(dataType, b ?? "")];
  }
  return coerceScalar(dataType, raw);
}
