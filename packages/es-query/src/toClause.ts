import { typeTransfer, type ValueType } from '@rfjs/data-transform';
import * as c from './clauses';
import { EsQueryError, UnsupportedClauseError } from './errors';
import type { EsClause, EsDialect, EsFieldCondition } from './types';

/** Clauses unavailable on a given dialect. */
const DIALECT_UNSUPPORTED: Record<EsDialect, Set<string>> = {
  elasticsearch: new Set<string>(),
  opensearch: new Set<string>(['combined_fields']),
};

function guardField(field: string): void {
  if (!field || /[\n\r]/.test(field)) {
    throw new EsQueryError(`Invalid field name: ${JSON.stringify(field)}`);
  }
}

function gate(clause: string, dialect: EsDialect): void {
  if (DIALECT_UNSUPPORTED[dialect].has(clause)) {
    throw new UnsupportedClauseError(clause, dialect);
  }
}

export function toClause(cond: EsFieldCondition, dialect: EsDialect): EsClause {
  guardField(cond.field);
  const { field, condition, fieldType, dataType, fields } = cond;
  const raw = Array.isArray(cond.value) ? cond.value : [cond.value];
  const values: ValueType[] = raw.map((v) => typeTransfer(v, dataType ?? 'any'));
  const [first] = values;
  const targetFields = fields ?? [field];

  switch (condition) {
    case 'eq':
      return fieldType === 'text' ? c.match(field, first) : c.term(field, first);
    case 'neq':
      return c.negate(fieldType === 'text' ? c.match(field, first) : c.term(field, first));
    case 'in':
      return c.terms(field, values);
    case 'notIn':
      return c.negate(c.terms(field, values));
    case 'lt':
      return c.range(field, { lt: first });
    case 'lte':
      return c.range(field, { lte: first });
    case 'gt':
      return c.range(field, { gt: first });
    case 'gte':
      return c.range(field, { gte: first });
    case 'between':
      return c.range(field, { gte: values[0], lte: values[1] });
    case 'contains':
      return c.wildcard(field, `*${String(first)}*`);
    case 'startsWith':
      return c.prefix(field, first);
    case 'endsWith':
      return c.wildcard(field, `*${String(first)}`);
    case 'exists':
      return c.exists(field);
    case 'isNull':
      return c.negate(c.exists(field));
    case 'match':
      return c.match(field, first);
    case 'matchPhrase':
      return c.matchPhrase(field, first);
    case 'multiMatch':
      return c.multiMatch(targetFields, first);
    case 'combinedFields':
      gate('combined_fields', dialect);
      return c.combinedFields(targetFields, first);
    case 'fuzzy':
      return c.fuzzy(field, first);
    case 'regex':
      return c.regexp(field, first);
    default: {
      const exhaustive: never = condition;
      throw new EsQueryError(`Unknown condition: ${String(exhaustive)}`);
    }
  }
}
