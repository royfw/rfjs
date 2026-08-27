import { arityOf } from "./engines/arity";
import type { BuilderGroup, FieldSchema, FieldType, LogicOp } from "./types";

/**
 * Error codes emitted by {@link validateTree}. Stable strings so a UI can map
 * them to messages / highlight the offending row (via `nodeId`).
 */
export type ValidateErrorCode =
  | "notAGroup"
  | "invalidLogic"
  | "emptyGroup"
  | "nestedGroupNotAllowed"
  | "invalidNode"
  | "unknownField"
  | "dataTypeMismatch"
  | "missingElementType"
  | "operatorNotAllowed"
  | "missingValue";

export interface ValidateError {
  /** `id` of the offending group / condition, when the node carries one. */
  nodeId?: string;
  /** Field path of the offending condition, for messages that name the field. */
  path?: string;
  code: ValidateErrorCode;
}

export interface ValidateOptions {
  /**
   * App-level operator allowlist per dataType. When an entry exists for a
   * condition's `dataType`, its `operator` must be in the list. Intended to be
   * the intersection the consumer cares about (e.g. what both `data-filter` and
   * `pg-filter` support) — compute it with `getEngine(id).operators(...)`.
   */
  operators?: Partial<Record<FieldType, string[]>>;
  /** Reject nested groups (single-level trees only). Default: true (allowed). */
  allowNestedGroups?: boolean;
  /** Minimum children per group. Default 1 — rejects the `and`-of-empty ≡ true that matches everyone. */
  minChildren?: number;
}

export type ValidateResult =
  | { ok: true; tree: BuilderGroup }
  | { ok: false; errors: ValidateError[] };

const LOGIC_OPS: readonly LogicOp[] = ["and", "or", "nor", "not"];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function walkGroup(
  node: unknown,
  schema: Map<string, FieldSchema>,
  options: Required<Pick<ValidateOptions, "allowNestedGroups" | "minChildren">> &
    Pick<ValidateOptions, "operators">,
  errors: ValidateError[],
): void {
  if (!isRecord(node) || node.kind !== "group") {
    errors.push({ code: "notAGroup", nodeId: isRecord(node) ? (node.id as string | undefined) : undefined });
    return;
  }
  const nodeId = typeof node.id === "string" ? node.id : undefined;
  if (!LOGIC_OPS.includes(node.logic as LogicOp)) {
    errors.push({ nodeId, code: "invalidLogic" });
  }
  const children = Array.isArray(node.children) ? node.children : [];
  if (children.length < options.minChildren) {
    errors.push({ nodeId, code: "emptyGroup" });
  }
  for (const child of children) {
    if (isRecord(child) && child.kind === "group") {
      if (!options.allowNestedGroups) {
        errors.push({ nodeId: child.id as string | undefined, code: "nestedGroupNotAllowed" });
        continue;
      }
      walkGroup(child, schema, options, errors);
    } else {
      walkCondition(child, schema, options, errors);
    }
  }
}

function walkCondition(
  node: unknown,
  schema: Map<string, FieldSchema>,
  options: Pick<ValidateOptions, "operators">,
  errors: ValidateError[],
): void {
  if (!isRecord(node) || node.kind !== "condition") {
    errors.push({ code: "invalidNode", nodeId: isRecord(node) ? (node.id as string | undefined) : undefined });
    return;
  }
  const nodeId = typeof node.id === "string" ? node.id : undefined;
  const field = typeof node.field === "string" ? node.field : undefined;
  const operator = typeof node.operator === "string" ? node.operator : undefined;
  const path = field;

  if (!field || !operator) {
    errors.push({ nodeId, path, code: "invalidNode" });
    return;
  }

  const fieldSchema = schema.get(field);
  if (!fieldSchema) {
    errors.push({ nodeId, path, code: "unknownField" });
    return; // no schema → the remaining checks can't be trusted
  }

  if (node.dataType !== fieldSchema.dataType) {
    errors.push({ nodeId, path, code: "dataTypeMismatch" });
  }

  // Array conditions must carry elementType, or the engine throws at match time
  // and the failure is swallowed into `uncoverable` (see issue #266).
  if (fieldSchema.dataType === "array" && !node.elementType) {
    errors.push({ nodeId, path, code: "missingElementType" });
  }

  const allowlist = options.operators?.[fieldSchema.dataType];
  if (allowlist && !allowlist.includes(operator)) {
    errors.push({ nodeId, path, code: "operatorNotAllowed" });
  }

  // Value presence: everything except the "none"-arity ops (isnull, isnotnull,
  // elemmatch, …) needs a value. elemmatch carries `filters`, not `value`.
  if (arityOf(operator) !== "none" && operator !== "elemmatch") {
    if (node.value === undefined || node.value === null) {
      errors.push({ nodeId, path, code: "missingValue" });
    }
  }

  // DECISION: an `elemmatch` condition is validated as a leaf — we do NOT descend
  // into its inner `filters` group. The inner conditions reference element-relative
  // paths (e.g. `sku`, `qty` inside each array element) that are absent from the
  // flat, top-level `FieldSchema[]` this validator is given, so recursing would
  // spuriously report every inner field as `unknownField`. Validating the element
  // sub-schema is out of scope here; callers with an element schema should validate
  // the inner group separately. (Pinned by test.)
}

/**
 * Validate a candidate `BuilderGroup` against a field-schema allowlist before
 * persisting or evaluating it. Reports **per-node** errors (`nodeId`/`path`) so
 * a UI can highlight the offending row. This is the write-time flip side of the
 * evaluation-time silent failure in issue #266. See issue #278.
 */
export function validateTree(
  tree: unknown,
  schema: FieldSchema[],
  options: ValidateOptions = {},
): ValidateResult {
  const errors: ValidateError[] = [];
  const schemaMap = new Map(schema.map((f) => [f.path, f]));
  walkGroup(
    tree,
    schemaMap,
    {
      allowNestedGroups: options.allowNestedGroups ?? true,
      minChildren: options.minChildren ?? 1,
      operators: options.operators,
    },
    errors,
  );
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, tree: tree as BuilderGroup };
}
