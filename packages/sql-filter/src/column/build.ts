import { ParamBuilder } from '../param-builder';
import { buildFilterGroup } from '../engine';
import { ColumnQueryError } from '../errors';
import type { FilterGroup } from '../types';
import type { ColumnConfig } from './config';
import { makeColumnLeafRenderer, type ColumnCondition } from './leaf';

export function buildColumnQuery(
  config: ColumnConfig,
  group: FilterGroup<ColumnCondition>,
  options: { paramOffset?: number } = {},
): { where: string; values: unknown[] } {
  const offset = options.paramOffset ?? 0;
  if (!Number.isInteger(offset) || offset < 0) {
    throw new ColumnQueryError(`Invalid paramOffset: ${String(offset)}`, 'INVALID_PARAM_OFFSET');
  }
  const params = new ParamBuilder(offset);
  const where = buildFilterGroup(group, makeColumnLeafRenderer(config), params);
  return { where, values: params.values };
}
