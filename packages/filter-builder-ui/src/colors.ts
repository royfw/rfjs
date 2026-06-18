import type { LogicOp } from "@rfjs/filter-builder";

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

// Badge-style background + text per logic op (matches the design mockup, where
// the group operator reads as a colored pill rather than a bordered input).
const LOGIC_BADGE: Record<LogicOp, string> = {
  and: "bg-intake/12 text-intake",
  or: "bg-yield/15 text-yield",
  nor: "bg-muted text-muted-foreground",
  not: "bg-fault/12 text-fault",
};

export function logicBadge(op: LogicOp): string {
  return LOGIC_BADGE[op];
}

export function dataTypeColor(dataType: string): string {
  return DATATYPE[dataType] ?? "text-muted-foreground";
}

// Badge-style background + text per data type — used for the type indicator and
// for value tags, so each is clearly colored (more visible than plain text).
const DATATYPE_BADGE: Record<string, string> = {
  string: "bg-intake/15 text-intake",
  numeric: "bg-yield/18 text-yield",
  boolean: "bg-fault/15 text-fault",
  date: "bg-signal/10 text-signal",
  object: "bg-muted text-muted-foreground",
  array: "bg-muted text-muted-foreground",
};

export function dataTypeBadge(dataType: string): string {
  return DATATYPE_BADGE[dataType] ?? "bg-muted text-muted-foreground";
}

const DATATYPE_SHORT: Record<string, string> = {
  string: "str",
  numeric: "num",
  date: "date",
  boolean: "bool",
  object: "obj",
  array: "arr",
};

export function dataTypeShort(dataType: string): string {
  return DATATYPE_SHORT[dataType] ?? dataType;
}
