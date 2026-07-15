import { getByPath } from '@rfjs/object-utils';
import { compile } from '@rfjs/data-expr';
import type { DataSource, DataSourceDialect, DataSourceFetcher, FieldOption } from './types';

export async function extractValue(
  dialect: DataSourceDialect,
  expr: string,
  data: unknown,
): Promise<unknown> {
  switch (dialect) {
    case 'path':
      return Promise.resolve(getByPath(data, expr));
    case 'jsonata':
      return compile(expr).evaluate(data);
    case 'jsonpath':
      throw new Error('dataSource: jsonpath dialect not supported yet');
  }
}

export async function loadDataSource(
  ds: DataSource,
  fetcher: DataSourceFetcher,
): Promise<unknown> {
  const raw = await fetcher(ds.request);
  return extractValue(ds.extract.dialect, ds.extract.expr, raw);
}

export function toOptions(extracted: unknown, ds: DataSource): FieldOption[] {
  if (!Array.isArray(extracted)) return [];
  return extracted.map((item) => {
    // Pass through {label, value} objects when no mapping specified
    if (
      !ds.optionLabel &&
      !ds.optionValue &&
      item !== null &&
      typeof item === 'object' &&
      'label' in item &&
      'value' in item
    ) {
      return item as FieldOption;
    }
    const label = String(ds.optionLabel ? getByPath(item, ds.optionLabel) : item);
    const value = ds.optionValue
      ? (getByPath(item, ds.optionValue) as string | number)
      : (item as string | number);
    return { label, value };
  });
}
