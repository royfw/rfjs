import * as _ from 'lodash';
import { MatchBooleanQuery } from '../match/MatchBooleanQuery';
import { MatchNumericQuery } from '../match/MatchNumericQuery';
import { MatchTextQuery } from '../match/MatchTextQuery';
import type {
  DataType,
  ObjectData,
  FilterMatchQuery,
  MatchQueryMetadata,
  LogicalOperator,
  TextFilterOperator,
  NumericFilterOperator,
  BooleanFilterOperator,
} from '../types';

export function filterMatchQueryArrayData(
  data: ObjectData[],
  filters: FilterMatchQuery[],
): ObjectData[] {
  if (filters.length == 0) {
    return data;
  }
  const set = filters.reduce((pre, cur) => {
    for (const val of data) {
      if (filterMatchQueryData(val, cur)) {
        pre.add(val);
      }
    }
    return pre;
  }, new Set<ObjectData>());
  return Array.from(set.values());
}

export function filterMatchQueryData(
  data: ObjectData,
  filterQuery: FilterMatchQuery,
): boolean {
  const { logic, filters } = filterQuery;
  const matchs = filters.reduce(
    (pre, cur) => {
      if (isFilterMatchQuery(cur)) {
        const nestedMatch = filterMatchQueryData(
          data,
          cur as FilterMatchQuery,
        );
        pre.push(nestedMatch);
        return pre;
      }
      const matchQuery = factoryMatchQuery(
        data,
        cur as MatchQueryMetadata,
      );
      const isMatch = matchQuery.isMatch;
      pre.push(isMatch);
      return pre;
    },
    <boolean[]>[],
  );
  const logicMatch = logicMatchQuery(logic, matchs);
  return logicMatch;
}

function logicMatchQuery(logic: LogicalOperator, data: boolean[]) {
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

export function factoryMatchQuery(
  data: ObjectData,
  metadata: MatchQueryMetadata,
): MatchTextQuery | MatchNumericQuery | MatchBooleanQuery {
  const { field, operator, value, dataType } = metadata;
  const query = {
    string: () =>
      new MatchTextQuery(
        field,
        operator as TextFilterOperator,
        value,
        data,
      ),
    numeric: () =>
      new MatchNumericQuery(
        field,
        operator as NumericFilterOperator,
        value,
        data,
      ),
    boolean: () =>
      new MatchBooleanQuery(
        field,
        operator as BooleanFilterOperator,
        value,
        data,
      ),
  };
  return query[dataType]();
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
    boolean: () =>
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      ['true', 'false'].includes(value as string)
        ? JSON.parse(value as string)
        : Boolean(value),
    regex: () => new RegExp(value as string),
  };
  if (!_.has(transfer, type)) type = 'any';
  return transfer[type]();
};
