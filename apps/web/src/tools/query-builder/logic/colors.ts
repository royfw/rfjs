import type { LogicOp } from "./types";

const LOGIC: Record<LogicOp, string> = {
  and: "text-signal",
  or: "text-intake",
  nor: "text-yield",
  not: "text-fault",
};

const DATATYPE: Record<string, string> = {
  string: "text-signal",
  numeric: "text-intake",
  date: "text-yield",
  boolean: "text-fault",
  object: "text-muted-foreground",
  array: "text-muted-foreground",
};

export function logicColor(op: LogicOp): string {
  return LOGIC[op];
}

export function dataTypeColor(dataType: string): string {
  return DATATYPE[dataType] ?? "text-muted-foreground";
}
