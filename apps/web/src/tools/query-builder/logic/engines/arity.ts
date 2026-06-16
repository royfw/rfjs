import type { OperatorArity } from "./types";

// Value-parameter count per operator. Anything not listed defaults to "one".
export const ARITY: Record<string, OperatorArity> = {
  isnull: "none",
  isnotnull: "none",
  isempty: "none",
  isnotempty: "none",
  elemmatch: "none",
  range: "two",
  terms: "list",
  containsall: "list",
  hasanykey: "list",
  hasallkeys: "list",
};

export function arityOf(op: string): OperatorArity {
  return ARITY[op] ?? "one";
}
