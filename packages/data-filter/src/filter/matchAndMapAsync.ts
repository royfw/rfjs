import _ from 'lodash';
import { compile, isExpression, stripExpressionPrefix } from '@rfjs/data-expr';
import type { CompiledExpr, ExprOptions } from '@rfjs/data-expr';
import { matchQueryAsync } from './compileMatchQuery';
import { aliasData } from '../alias/aliasData';
import type { FilterMatchQuery } from '../types';
import type { FilterMappingMetadata, MappingValue } from './matchAndMap';

type AnyObjectData = { [key: string]: any };

/**
 * Async variant of matchAndMap: mapping values (and filter slots) may be
 * "="-expressions. Mapping expressions are compiled ONCE per metadata (outside
 * the row loop); the filter still goes through per-row ${} alias substitution
 * and is matched via matchQueryAsync. Same contracts as matchAndMap otherwise:
 * caller input is never mutated, rows are deduped by source reference, the
 * last matching metadata's mapping wins.
 */
export async function matchAndMapAsync<T>(
  filterData: AnyObjectData[],
  filterMetadatas: FilterMappingMetadata[],
  exData: AnyObjectData = {},
  dataKey = 'data',
  options?: ExprOptions,
): Promise<T[]> {
  if (filterMetadatas.length === 0) {
    return filterData as T[];
  }

  const compiledMappings = filterMetadatas.map((metadata) =>
    (metadata.mappings ?? []).map((mapping) =>
      typeof mapping.value === 'string' && isExpression(mapping.value)
        ? compile(stripExpressionPrefix(mapping.value), options)
        : null,
    ),
  );

  const matched = new Map<AnyObjectData, T>();
  for (let m = 0; m < filterMetadatas.length; m += 1) {
    const { filter, mappings } = filterMetadatas[m];
    for (const item of filterData) {
      const source: AnyObjectData = { ...exData, [dataKey]: item };
      const convertFilter = aliasData<FilterMatchQuery>(filter, source);
      if (!(await matchQueryAsync(source, convertFilter, options))) continue;

      const clonedItem = _.cloneDeep(item);
      const mapped: AnyObjectData = { ...exData, [dataKey]: clonedItem };
      const convertMapping = aliasData<MappingValue[]>(mappings ?? [], mapped);
      for (let i = 0; i < convertMapping.length; i += 1) {
        const expr: CompiledExpr | null = compiledMappings[m][i];
        const { key, value } = convertMapping[i];
        mapped[dataKey][key] = expr ? await expr.evaluate(mapped) : value;
      }
      matched.set(item, _.get(mapped, dataKey) as T);
    }
  }
  return Array.from(matched.values());
}
