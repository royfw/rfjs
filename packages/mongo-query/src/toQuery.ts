import { typeTransfer, type MgoDataType, type ValueType } from '@rfjs/data-transform';
import {
  TermsQuery,
  RegexQuery,
  RangeQuery,
  GTQuery,
  LTQuery,
  GTEQuery,
  LTEQuery,
  EqQuery,
  NeQuery,
  NinQuery,
} from './query';

export type MgoConditionType = 'eq' | 'neq' | 'nin' | 'terms' | 'term' | 'gt' | 'gte' | 'lt' | 'lte' | 'range' | 'regex';

export function toQuery(
  field: string,
  type: MgoDataType,
  condition: MgoConditionType,
  value: ValueType,
): Record<string, any> {
  // A field name is used directly as a query key; one starting with `$` would
  // be interpreted by MongoDB as a top-level operator (NoSQL operator
  // injection). MongoDB field names may not start with `$`, so reject it.
  if (field.startsWith('$')) {
    throw new Error(`Invalid field name: "${field}" must not start with "$"`);
  }
  const values = [].concat(value).map((i) => typeTransfer(i, type));
  const terms = (_field: string, _values: Array<any>) => {
    return new TermsQuery(_field, _values);
  };
  const term = terms;
  const range = (_field: string, _values: Array<number | Date>) => {
    const [start, end] = _values;
    return new RangeQuery(_field, start, end);
  };
  const gt = (_field: string, _values: Array<number | Date>) => {
    const [value] = _values;
    return new GTQuery(_field, value);
  };
  const gte = (_field: string, _values: Array<number | Date>) => {
    const [value] = _values;
    return new GTEQuery(_field, value);
  };
  const lt = (_field: string, _values: Array<number | Date>) => {
    const [value] = _values;
    return new LTQuery(_field, value);
  };
  const lte = (_field: string, _values: Array<number | Date>) => {
    const [value] = _values;
    return new LTEQuery(_field, value);
  };
  const regex = (_field: string, _values: Array<unknown>) => {
    const [_value] = _values;
    // The typed data pipeline cannot yield a RegExp (MgoDataType has no
    // 'regex'), so coerce string patterns here and pass through real RegExps.
    const pattern = _value instanceof RegExp ? _value : new RegExp(String(_value));
    return new RegexQuery(_field, pattern);
  };
  const eq = (_field: string, _values: Array<any>) => {
    const [value] = _values;
    return new EqQuery(_field, value);
  };
  const neq = (_field: string, _values: Array<any>) => {
    const [value] = _values;
    return new NeQuery(_field, value);
  };
  const nin = (_field: string, _values: Array<any>) => {
    return new NinQuery(_field, _values);
  };
  const handlers = {
    terms,
    term,
    gt,
    gte,
    lt,
    lte,
    regex,
    range,
    eq,
    neq,
    nin,
  };
  const handler = handlers[condition];
  if (!handler) {
    throw new Error(`Unknown condition: "${condition}"`);
  }
  return handler(field, values);
}
