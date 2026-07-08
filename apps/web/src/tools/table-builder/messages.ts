import type { LocaleMessages } from "@/tools/types";

// `tb*`-prefixed ToolUI keys (design spec §6.1): Task 8 ships the static preview only, so most
// keys below are only consumed by the `<ConfigTable>` labels deck for now; the data-source/
// columns/pagination editor panel copy is defined here ahead of Task 9 so the editor work can
// wire it straight into `t()` without another shared-file append.
export const messages: LocaleMessages = {
  en: {
    Tools: {
      "table-builder": {
        title: "Table Builder",
        description:
          "Config-driven data table — derive column config from a data resource's metadata, edit it, and preview offset/page/cursor pagination live.",
      },
    },
    ToolUI: {
      tbEyebrow: "TABLE BUILDER",
      tbPreviewTitle: "Preview",
      tbEmpty: "No data",
      tbLoading: "Loading…",
      tbErrorState: "Something went wrong.",
      tbRetry: "Retry",
      tbPrev: "Previous",
      tbNext: "Next",
      tbPageOf: "Page {page} of {count}",
      tbTotalRows: "{total} rows",
      tbPageSizeLabel: "Rows per page",
      tbSourcePanelTitle: "Data source",
      tbSourceStatic: "Static rows",
      tbSourceFetcher: "Fake fetcher",
      tbStrategyOffset: "Offset",
      tbStrategyPage: "Page",
      tbStrategyCursor: "Cursor",
      tbColumnsPanelTitle: "Columns",
      tbColumnVisible: "Visible",
      tbColumnLabel: "Label",
      tbColumnFormat: "Format",
      tbColumnSortable: "Sortable",
      tbColumnPin: "Pin",
      tbPinNone: "None",
      tbPinLeft: "Left",
      tbPinRight: "Right",
      tbPaginationPanelTitle: "Pagination",
      tbEmptyTextLabel: "Empty state text",
    },
  },
  "zh-TW": {
    Tools: {
      "table-builder": {
        title: "表格建構器",
        description:
          "設定驅動的資料表 —— 從資料來源的 metadata 衍生欄位設定、可再編輯,並即時預覽 offset/page/cursor 三種分頁。",
      },
    },
    ToolUI: {
      tbEyebrow: "表格建構器",
      tbPreviewTitle: "預覽",
      tbEmpty: "沒有資料",
      tbLoading: "載入中…",
      tbErrorState: "發生錯誤。",
      tbRetry: "重試",
      tbPrev: "上一頁",
      tbNext: "下一頁",
      tbPageOf: "第 {page} / {count} 頁",
      tbTotalRows: "共 {total} 筆",
      tbPageSizeLabel: "每頁筆數",
      tbSourcePanelTitle: "資料來源",
      tbSourceStatic: "靜態資料",
      tbSourceFetcher: "假 fetcher",
      tbStrategyOffset: "Offset",
      tbStrategyPage: "Page",
      tbStrategyCursor: "Cursor",
      tbColumnsPanelTitle: "欄位",
      tbColumnVisible: "顯示",
      tbColumnLabel: "標籤",
      tbColumnFormat: "格式",
      tbColumnSortable: "可排序",
      tbColumnPin: "固定",
      tbPinNone: "無",
      tbPinLeft: "靠左",
      tbPinRight: "靠右",
      tbPaginationPanelTitle: "分頁",
      tbEmptyTextLabel: "空狀態文字",
    },
  },
};
