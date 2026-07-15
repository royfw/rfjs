import { SAMPLE_ROWS, SAMPLE_META, SAMPLE_CONFIG } from "@/tools/table-builder/sample";
import type { TableColumnConfig } from "@rfjs/table-builder";
import type { DataFieldMeta } from "@rfjs/data-schema";

export interface QueryResource {
  rows: Record<string, unknown>[];
  columns: TableColumnConfig[];
  fields: DataFieldMeta[];
}

// 服務與 table-builder 工具相同的 rows，所以工具把 transport 從 in-memory 切成 HTTP 時，
// 回傳的資料一模一樣（證明變的只有 transport）。
const RESOURCES: Record<string, QueryResource> = {
  sample: { rows: SAMPLE_ROWS, columns: SAMPLE_CONFIG.columns, fields: SAMPLE_META.fields },
};

export function getResource(id: string): QueryResource | undefined {
  return RESOURCES[id];
}
