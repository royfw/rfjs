export type LogicOp = "and" | "or" | "nor" | "not";
export type ScalarType = "string" | "numeric" | "date" | "boolean";
export type FieldType = ScalarType | "object" | "array";
export type ElementType = ScalarType | "object";

export interface BuilderGroup {
  kind: "group";
  id: string;
  logic: LogicOp;
  children: BuilderItem[];
}

export interface BuilderCondition {
  kind: "condition";
  id: string;
  field: string;
  dataType: FieldType;
  elementType?: ElementType; // when dataType === "array"
  operator: string; // validated against the selected engine's matrix
  value?: unknown; // coerced value (see value-coerce)
  filters?: BuilderGroup; // when operator === "elemmatch"
}

export type BuilderItem = BuilderGroup | BuilderCondition;

export interface FieldSchema {
  path: string;
  dataType: FieldType;
  elementType?: ElementType;
  include: boolean;
}
