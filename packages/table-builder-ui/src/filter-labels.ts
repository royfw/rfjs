import type { FilterTreeLabels } from '@rfjs/filter-builder-ui';

/** ConfigTable 內建的英文 filter 樹標籤;消費端可用 filterLabels prop 覆寫。 */
export const DEFAULT_FILTER_TREE_LABELS: FilterTreeLabels = {
  logic: { and: 'AND', or: 'OR', nor: 'NOR', not: 'NOT' },
  addCondition: '+ condition',
  addGroup: '+ group',
  removeGroup: 'remove group',
  removeCondition: 'remove',
  elemMatch: 'elemmatch',
  toggleGroup: 'toggle group',
  collapsedConditions: 'cond',
  collapsedGroups: 'grp',
  collapsedEmpty: 'empty',
};
