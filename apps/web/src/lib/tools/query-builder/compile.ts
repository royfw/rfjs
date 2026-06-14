import type { BuilderCondition, BuilderGroup, BuilderItem } from "./types";

// Structural filter shape shared with @rfjs/jsonb-query / @rfjs/data-filter (no id).
export interface FilterGroupLike {
  logic: string;
  filters: Array<FilterConditionLike | FilterGroupLike>;
}
export interface FilterConditionLike {
  field: string;
  dataType: string;
  elementType?: string;
  operator: string;
  value?: unknown;
  filters?: FilterGroupLike;
}

function isComplete(c: BuilderCondition): boolean {
  return c.field.length > 0 && c.operator.length > 0;
}

function conditionToFilter(c: BuilderCondition): FilterConditionLike {
  const out: FilterConditionLike = { field: c.field, dataType: c.dataType, operator: c.operator };
  if (c.elementType) out.elementType = c.elementType;
  if (c.operator === "elemmatch" && c.filters) {
    out.filters = treeToFilterGroup(c.filters);
  } else if (c.value !== undefined) {
    out.value = c.value;
  }
  return out;
}

export function treeToFilterGroup(group: BuilderGroup): FilterGroupLike {
  const filters: FilterGroupLike["filters"] = [];
  for (const child of group.children as BuilderItem[]) {
    if (child.kind === "group") filters.push(treeToFilterGroup(child));
    else if (isComplete(child)) filters.push(conditionToFilter(child));
  }
  return { logic: group.logic, filters };
}
