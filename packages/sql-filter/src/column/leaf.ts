import { ParamBuilder } from '../param-builder';
import { ColumnQueryError } from '../errors';
import type { ColumnConfig } from './config';
import { quoteIdent } from './ident';
import { renderColumnCondition, type ColumnOperator } from './operators';

export type ColumnCondition = {
  column: string;
  operator: ColumnOperator;
  value?: unknown;
};

export function makeColumnLeafRenderer(
  config: ColumnConfig,
): (leaf: ColumnCondition, params: ParamBuilder) => string {
  return (leaf, params) => {
    const def = config[leaf.column];
    if (!def) {
      throw new ColumnQueryError(`Unknown column: ${JSON.stringify(leaf.column)}`, 'UNKNOWN_COLUMN');
    }
    return renderColumnCondition(quoteIdent(def.column), def.type, leaf.operator, leaf.value, params);
  };
}
