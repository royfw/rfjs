import { toJsonbQuery } from './toQuery';
import { ISqlQuery, QueryMetadata } from './type';

export const metadetaListToJsonbQuery = (
  jsonb: string,
  queryMetadataList: QueryMetadata[],
): ISqlQuery[] => {
  return queryMetadataList.reduce(
    (pre, cur) => {
      const jsonbQuery = toJsonbQuery(
        jsonb,
        cur.field,
        cur.operator,
        cur.dataType,
        cur.value,
      );
      if (jsonbQuery) {
        pre.push(jsonbQuery);
      }
      return pre;
    },
    <ISqlQuery[]>[],
  );
};
