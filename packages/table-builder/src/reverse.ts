import type { DataFieldMeta, DataResourceMeta, RequestMeta, ResponseMeta } from '@rfjs/data-schema';
import type { TableConfig } from './types';

// Reverse projection of `deriveTableConfig` (design spec 2026-07-09 §1): columns map back to a
// pure data description; display-only keys (visible/pin/align) are dropped. Like `derive`,
// label/options are copied so the returned meta never shares references with the config.
export function tableConfigToResourceMeta(
  config: TableConfig,
  request?: RequestMeta,
  response?: ResponseMeta,
): DataResourceMeta {
  const fields: DataFieldMeta[] = config.columns.map((column) => {
    const field: DataFieldMeta = {
      key: column.key,
      label: typeof column.label === 'object' ? { ...column.label } : column.label,
      dataType: column.dataType,
    };
    if (column.format !== undefined) field.format = column.format;
    if (column.options !== undefined) {
      field.options = column.options.map((o) => ({
        ...o,
        ...(typeof o.label === 'object' ? { label: { ...o.label } } : {}),
      }));
    }
    if (column.sortable !== undefined) field.sortable = column.sortable;
    if (column.filterable !== undefined) field.filterable = column.filterable;
    return field;
  });

  const meta: DataResourceMeta = { fields };
  if (request !== undefined) meta.request = request;
  if (response !== undefined) meta.response = response;
  return meta;
}
