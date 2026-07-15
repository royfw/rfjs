# @rfjs/data-schema-ui

[`@rfjs/data-schema`](../data-schema) 的共用**協定編輯器**(React):
編輯 `DataResourceMeta` 的 `request`/`response` 協定 —— endpoint、method、
分頁策略與參數、排序/篩選編碼、回應路徑 —— 內建「試打 endpoint」
(`buildRequestParams` → `makeHttpFetcher` → `extractRows`)。

私有 workspace package,經 Next.js `transpilePackages` 消費(無 build)。
文案以 props 傳入(`ProtocolPanelLabels`),i18n 由 app 持有。

## 用法

```tsx
import { ProtocolPanel, DEFAULT_REQUEST, DEFAULT_RESPONSE } from "@rfjs/data-schema-ui";
import type { ProtocolPanelLabels } from "@rfjs/data-schema-ui";

<ProtocolPanel
  request={request}   // RequestMeta | undefined
  response={response} // ResponseMeta | undefined
  onChange={({ request, response }) => ...}
  labels={labels}     // ProtocolPanelLabels — 全部字串由 app 提供
  showEnableToggle    // 選配,預設 true —— 「宣告協定」開關
/>
```

與 `@rfjs/filter-builder` ↔ `@rfjs/filter-builder-ui` 同形:engine
(`@rfjs/data-schema`)維持 framework-agnostic,本包是其上的薄 React 編輯層。
