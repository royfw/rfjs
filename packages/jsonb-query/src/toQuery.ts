import { jsonbTransfer, JsonbDataType, ValueType } from '@rfjs/data-transform';
import { JsonbOperatorQuery, filterOperator } from './jsonbOperatorQuery';
import { FilterOperator, ISqlQuery } from './type';

export const toJsonbQuery = (
  jsonb: string,
  field: string,
  filter: FilterOperator,
  dataType: JsonbDataType,
  value: ValueType,
): ISqlQuery | null => {
  const values = []
    .concat(value)
    .map((el) => jsonbTransfer(el, dataType));
  if (!Object.keys(filterOperator).includes(filter)) {
    return null;
  }
  return new JsonbOperatorQuery(jsonb, field, filter, dataType, values);
};
