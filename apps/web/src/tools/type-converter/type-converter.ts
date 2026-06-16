import { typeTransfer, type DataType } from "@rfjs/data-transform";

// typeTransfer's date branch returns a Date; number/integer use Number() (can be NaN).
export const CONVERT_TYPES: DataType[] = ["string", "number", "integer", "boolean", "date", "any"];

export type ConvertResult =
  | { ok: true; output: string; runtimeType: string }
  | { ok: false; error: "nan" | "invalidDate" };

export function convertType(input: string, type: DataType): ConvertResult {
  const result = typeTransfer(input, type);
  if ((type === "number" || type === "integer") && Number.isNaN(result as number)) {
    return { ok: false, error: "nan" };
  }
  if (type === "date") {
    const d = result as Date;
    if (Number.isNaN(d.getTime())) return { ok: false, error: "invalidDate" };
    return { ok: true, output: d.toISOString(), runtimeType: "Date" };
  }
  return { ok: true, output: String(result), runtimeType: typeof result };
}
