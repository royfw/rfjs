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
  const regex = (_field: string, _values: Array<RegExp>) => {
    const [_value] = _values;
    return new RegexQuery(_field, _value);
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
  return {
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
  }[condition](field, values);
}
