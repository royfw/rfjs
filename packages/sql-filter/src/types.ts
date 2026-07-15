export type LogicalOperator = 'and' | 'or' | 'nor' | 'not';

export type FilterGroup<L> = {
  logic: LogicalOperator;
  filters: Array<L | FilterGroup<L>>;
};
