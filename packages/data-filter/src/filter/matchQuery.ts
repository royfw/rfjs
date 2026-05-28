import * as _ from 'lodash';
import { BooleanMatch } from '../match/BooleanMatch';
import { NumericMatch } from '../match/NumericMatch';
import { TextMatch } from '../match/TextMatch';
import { DateMatch } from '../match/DateMatch';
import type {
  DataType,
  ObjectData,
  FilterMatchQuery,
  MatchQueryMetadata,
  LogicalOperator,
  TextFilterOperator,
  NumericFilterOperator,
  BooleanFilterOperator,
  DateFilterOperator,
} from '../types';

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

export function createMatchQuery(
  data: ObjectData,
  metadata: MatchQueryMetadata,
): TextMatch | NumericMatch | BooleanMatch | DateMatch {
  const { field, operator, value, dataType } = metadata;
  const query = {
    string: () =>
      new TextMatch(
        field,
        operator as TextFilterOperator,
        value,
        data,
      ),
    numeric: () =>
      new NumericMatch(
        field,
        operator as NumericFilterOperator,
        value,
        data,
      ),
    boolean: () =>
      new BooleanMatch(
        field,
        operator as BooleanFilterOperator,
        value,
        data,
      ),
    date: () =>
      new DateMatch(
        field,
        operator as DateFilterOperator,
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
