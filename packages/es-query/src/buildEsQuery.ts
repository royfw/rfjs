import { toClause } from './toClause';
import {
  isEsFieldCondition,
  isEsFilterMetadata,
  type EsBoolQuery,
  type EsDialect,
  type EsFilterMetadata,
  type EsQueryClause,
} from './types';

export interface BuildEsQueryOptions {
  dialect?: EsDialect;
}

export function buildEsQuery(
  metadata: EsFilterMetadata,
  opts: BuildEsQueryOptions = {},
): EsBoolQuery {
  const dialect = opts.dialect ?? 'elasticsearch';

  const clauses: EsQueryClause[] = metadata.filters.map((child) => {
    if (isEsFilterMetadata(child)) return buildEsQuery(child, opts);
    if (isEsFieldCondition(child)) return toClause(child, dialect);
    return {};
  });

  switch (metadata.logic) {
    case 'or':
      // any match
      return { bool: { should: clauses, minimum_should_match: 1 } };
    case 'nor':
      // none match: NOT(a OR b) — each clause directly excluded
      return { bool: { must_not: clauses } };
    case 'not': {
      // not all: NOT(a AND b) — exclude the conjunction, not each clause
      const negated: EsQueryClause =
        clauses.length === 1 ? clauses[0] : { bool: { must: clauses } };
      return { bool: { must_not: [negated] } };
    }
    case 'and':
    default:
      return { bool: { must: clauses } };
  }
}
