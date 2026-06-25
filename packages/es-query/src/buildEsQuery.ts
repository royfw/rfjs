import { toClause } from './toClause';
import {
  isEsFieldCondition,
  isEsFilterMetadata,
  type EsBoolQuery,
  type EsDialect,
  type EsFilterMetadata,
  type EsLogicalOperator,
  type EsQueryClause,
} from './types';

export interface BuildEsQueryOptions {
  dialect?: EsDialect;
}

const BUCKET: Record<EsLogicalOperator, 'must' | 'should' | 'must_not'> = {
  and: 'must',
  or: 'should',
  not: 'must_not',
  nor: 'must_not',
};

export function buildEsQuery(
  metadata: EsFilterMetadata,
  opts: BuildEsQueryOptions = {},
): EsBoolQuery {
  const dialect = opts.dialect ?? 'elasticsearch';
  const bucket = BUCKET[metadata.logic] ?? 'must';

  const clauses: EsQueryClause[] = metadata.filters.map((child) => {
    if (isEsFilterMetadata(child)) return buildEsQuery(child, opts);
    if (isEsFieldCondition(child)) return toClause(child, dialect);
    return {};
  });

  const bool: EsBoolQuery['bool'] = { [bucket]: clauses };
  if (metadata.logic === 'or') bool.minimum_should_match = 1;
  return { bool };
}
