import type { FilterGroupLike } from "../compile";
import type { ElementType, FieldKind, FieldType } from "../types";

export type OperatorArity = "none" | "one" | "two" | "list";

export interface OperatorSpec {
  op: string;
  arity: OperatorArity;
}

export type EngineId = "jsonb" | "data-filter" | "pg-filter" | "sql-filter" | "mongo";

export interface CompileField {
  path: string;
  kind: FieldKind;
  dataType: FieldType;
  elementType?: ElementType;
}

export interface CompileContext {
  fields: CompileField[];
}

export type EngineOutput =
  | { ok: true; primary: string; secondary?: string }
  | { ok: false; error: string };

export interface Engine {
  id: EngineId;
  label: string;
  operators(dataType: string, elementType?: string, kind?: FieldKind): OperatorSpec[];
  compile(group: FilterGroupLike, ctx: CompileContext): EngineOutput;
}
