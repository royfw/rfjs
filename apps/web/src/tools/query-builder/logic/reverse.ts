import type { FilterConditionLike, FilterGroupLike } from "./compile";
import type {
  BuilderCondition,
  BuilderGroup,
  BuilderItem,
  ElementType,
  FieldType,
  LogicOp,
} from "./types";

// Inverse of treeToFilterGroup: rebuild an editable tree (with ids) from a
// structural filter group. Round-trips: treeToFilterGroup(filterGroupToTree(g)) === g
// for groups whose leaves are complete (field + operator present).
export function filterGroupToTree(group: FilterGroupLike, makeId: () => string): BuilderGroup {
  return {
    kind: "group",
    id: makeId(),
    logic: group.logic as LogicOp,
    children: group.filters.map((item) => toItem(item, makeId)),
  };
}

function toItem(item: FilterConditionLike | FilterGroupLike, makeId: () => string): BuilderItem {
  return "field" in item ? toCondition(item, makeId) : filterGroupToTree(item, makeId);
}

function toCondition(c: FilterConditionLike, makeId: () => string): BuilderCondition {
  const out: BuilderCondition = {
    kind: "condition",
    id: makeId(),
    field: c.field,
    dataType: c.dataType as FieldType,
    operator: c.operator,
  };
  if (c.elementType) out.elementType = c.elementType as ElementType;
  if (c.operator === "elemmatch" && c.filters) {
    out.filters = filterGroupToTree(c.filters, makeId);
  } else if (c.value !== undefined) {
    out.value = c.value;
  }
  return out;
}
