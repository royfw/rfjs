import type { BuiltRequest, DataFieldMeta, RequestMeta, ResponseMeta } from '@rfjs/data-schema';

// Data-source injection (design spec §5.1): 'rows' is a static array sorted/paginated client-side;
// 'remote' hands the transport a `fetch` wrapper so tool pages can pass a fake fetcher while a real
// app passes a real one.
export type TableSource =
  | { kind: 'rows'; rows: Record<string, unknown>[] }
  | {
      kind: 'remote';
      request: RequestMeta;
      response: ResponseMeta;
      /** 遠端篩選的欄位描述(kind/dataType/filterable 的來源);缺省 = 此來源不可篩選。 */
      fields?: DataFieldMeta[];
      fetch: (built: BuiltRequest) => Promise<unknown>;
    };

// Optional labels (design spec §5.3): unlike filter-builder-ui's labels-as-props convention, this
// package ships English defaults so a result-item-embedded table doesn't have to carry a full
// copy deck.
export interface TableLabels {
  empty: string;
  loading: string;
  error: string;
  retry: string;
  prev: string;
  next: string;
  pageOf: string; // 'Page {page} of {count}'
  total: string; // '{total} rows'
  pageSize: string;
  /** 篩選區標題(收合列)。 */
  filterTitle: string;
  /** 篩選命中數,帶 {count} 佔位(ConfigTable 以 replacePlaceholders 代換)。 */
  filterMatched: string;
  /** 篩選含記憶體引擎不支援的條件時的警告。 */
  filterUncoverable: string;
  /** 遠端來源篩選停用時的說明。 */
  filterDisabled: string;
  /** remote 模式 Apply 鈕文字(選填;預設 'Apply')。 */
  filterApply?: string;
}
