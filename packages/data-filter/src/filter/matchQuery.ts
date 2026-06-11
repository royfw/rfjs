import _ from 'lodash';
import { BooleanMatch } from '../match/BooleanMatch';
import { NumericMatch } from '../match/NumericMatch';
import { TextMatch } from '../match/TextMatch';
import { DateMatch } from '../match/DateMatch';
import { ObjectMatch } from '../match/ObjectMatch';
import { ArrayMatch } from '../match/ArrayMatch';
import { ElemMatch } from '../match/ElemMatch';
import { hasWildcardSyntax } from '../path/resolve';
import type {
  DataType,
  ObjectData,
  FilterMatchQuery,
  MatchQueryMetadata,
  LogicalOperator,
} from '../types';
import { isExpression } from '@rfjs/data-expr';

export function matchQueryArray(
  data: ObjectData[],
  filters: FilterMatchQuery[],
): ObjectData[] {
  if (filters.length == 0) {
    return data;
  }
  const set = filters.reduce((pre, cur) => {
    for (const val of data) {
      if (matchQuery(val, cur)) {
        pre.add(val);
      }
    }
    return pre;
  }, new Set<ObjectData>());
  return Array.from(set.values());
}

export function matchQuery(
  data: ObjectData,
  filterQuery: FilterMatchQuery,
): boolean {
  const { logic, filters } = filterQuery;
  const matchs = filters.reduce(
    (pre, cur) => {
      if (isFilterMatchQuery(cur)) {
        const nestedMatch = matchQuery(
          data,
          cur as FilterMatchQuery,
        );
        pre.push(nestedMatch);
        return pre;
      }
      const query = createMatchQuery(
        data,
        cur as MatchQueryMetadata,
      );
      const isMatch = query.isMatch;
      pre.push(isMatch);
      return pre;
    },
    <boolean[]>[],
  );
  const logicMatch = logicMatchQuery(logic, matchs);
  return logicMatch;
}

export function logicMatchQuery(logic: LogicalOperator, data: boolean[]) {
  let result = false;
  switch (logic) {
    case 'and':
      result = data.every((v) => v);
      break;
    case 'not':
      result = !data.every((v) => v);
      break;
    case 'nor':
      result = !data.includes(true);
      break;
    case 'or':
      result = data.includes(true);
      break;
  }
  return result;
}

function isFilterMatchQuery(filter: FilterMatchQuery | MatchQueryMetadata) {
  return _.has(filter, 'logic');
}

export function createMatchQuery(
  data: ObjectData,
  metadata: MatchQueryMetadata,
): { isMatch: boolean } {
  if (
    isExpression(metadata.field) ||
    ('value' in metadata &&
      typeof metadata.value === 'string' &&
      isExpression(metadata.value))
  ) {
    throw new Error(
      `[data-filter] '=' expression slots require the async api — use compileMatchQuery or matchQueryAsync`,
    );
  }
  switch (metadata.dataType) {
    case 'string':
      return new TextMatch(metadata.field, metadata.operator, metadata.value, data);
    case 'numeric':
      return new NumericMatch(metadata.field, metadata.operator, metadata.value, data);
    case 'boolean':
      return new BooleanMatch(metadata.field, metadata.operator, metadata.value, data);
    case 'date':
      return new DateMatch(metadata.field, metadata.operator, metadata.value, data);
    case 'object':
      if (hasWildcardSyntax(metadata.field)) {
        throw new Error(
          `[data-filter] wildcard field is not supported for dataType 'object'; point field at the value`,
        );
      }
      return new ObjectMatch(metadata.field, metadata.operator, metadata.value, data);
    case 'array':
      if (hasWildcardSyntax(metadata.field)) {
        throw new Error(
          `[data-filter] wildcard field is not supported for dataType 'array'; point field at the value, or compose with elemmatch`,
        );
      }
      if (metadata.elementType === 'object') {
        return new ElemMatch(
          metadata.field,
          metadata.filters,
          data,
          (element, filters) => matchQuery(element as ObjectData, filters),
        );
      }
      return new ArrayMatch(
        metadata.field,
        metadata.elementType,
        metadata.operator,
        metadata.value,
        data,
      );
    default: {
      const _exhaustive: never = metadata;
      throw new Error(
        `[data-filter] unsupported dataType '${String((_exhaustive as { dataType: unknown }).dataType)}'`,
      );
    }
  }
}

export const typeTransfer = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any,
  type: DataType,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transfer: Record<string, () => any> = {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    any: () => value,
    date: () => new Date(value as string | number),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    string: () => value,
    number: () => Number(value),
    integer: () => Number(value),
    boolean: () => {
      if (typeof value === 'boolean') return value;
      const normalized = String(value).trim().toLowerCase();
      // Everything that is not an explicit falsy token is truthy. Fixes the old
      // Boolean('false')/Boolean('0') === true footgun.
      return !['false', '0', 'no', 'off', '', 'null', 'undefined'].includes(
        normalized,
      );
    },
    regex: () => new RegExp(value as string),
  };
  if (!_.has(transfer, type)) type = 'any';
  return transfer[type]();
};
