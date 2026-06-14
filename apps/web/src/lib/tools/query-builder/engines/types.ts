import type { FilterGroupLike } from "../compile";

export type OperatorArity = "none" | "one" | "two" | "list";

export interface OperatorSpec {
  op: string;
  arity: OperatorArity;
}

export type EngineId = "jsonb" | "data-filter";

export type EngineOutput =
  | { ok: true; primary: string; secondary?: string }
  | { ok: false; error: string };

export interface Engine {
  id: EngineId;
  label: string;
  operators(dataType: string, elementType?: string): OperatorSpec[];
  compile(group: FilterGroupLike): EngineOutput;
}
