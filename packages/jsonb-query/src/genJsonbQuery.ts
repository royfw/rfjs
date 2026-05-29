import { toJsonbQuery } from './toQuery';
import { FilterQueryMetadata, QueryMetadata } from './type';

export const genJsonbQuery = (
  jsonb: string,
  filterQuery: FilterQueryMetadata,
  from: string[] = [],
): { where: string; from: string[] } => {
  const { logic, filters } = filterQuery;
  const where = filters.reduce((pre, cur) => {
    if (
      (cur as FilterQueryMetadata).logic &&
      (cur as FilterQueryMetadata).filters.length > 0
    ) {
      const getNestedQuery = genJsonbQuery(
        jsonb,
        cur as FilterQueryMetadata,
        from,
      );
      const logicStr = `${pre} ${logic} `;
      pre = `${pre.length > 0 ? logicStr : ''}(${
        getNestedQuery.where
      })`;
      return pre;
    }
    const metadata = cur as QueryMetadata;
    const query = toJsonbQuery(
      jsonb,
      metadata.field,
      metadata.operator,
      metadata.dataType,
      metadata.value,
    );
    if (!query) {
      return pre;
    }
    if (query.from && query.fromAlias) {
      from.push(`${query.from} ${query.fromAlias}`);
    }
    pre = `${pre}${
      query.where ? `${pre.length > 0 ? ` ${logic}` : ''} ${query.where}` : ''
    }`;
    return pre;
  }, '');
  return {
    where: where,
    from: from,
  };
};
