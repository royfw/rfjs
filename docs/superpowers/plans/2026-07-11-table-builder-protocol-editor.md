# table-builder 內嵌 protocol 編輯器 實作計畫

> **給執行者:** 必用子技能:superpowers:subagent-driven-development(建議)或 superpowers:executing-plans。步驟用 checkbox(`- [ ]`)。

**目標:** 抽出 metadata-builder 的 `ProtocolPanel` 成 apps/web 共用元件,讓 table-builder 有可編的 endpoint/protocol(收斂 `SourceMode` 成 rows/remote,策略移進 panel),並修 source-panel 命名/i18n。

**架構:** ProtocolPanel 移到 `apps/web/src/components/protocol-panel/`,兩工具共用;table-builder 新增可編 `request`/`response` state 餵給它,remote source + Metadata tab 吃編輯狀態,HTTP fetcher 用 `makeHttpFetcher(request)`(#248)。protocol 的 i18n **重用既有 `mb*` key**(所有工具 messages 聚合成同一 `ToolUI` namespace,已驗證)。

**技術棧:** React 19、TypeScript、Vitest + @testing-library、next-intl、`@rfjs/data-schema`/`@rfjs/table-builder-ui`(消費)。

## 全域約束

- **不改 `packages/*`**。ProtocolPanel 抽到 `apps/web/src/components/`。
- **無 changeset**(只動 apps/web)。
- ProtocolPanel 抽出後 **metadata-builder 行為/外觀不變**(含 #248 try-endpoint)。
- i18n:含 `{count}` 的 label(`mbTryRows`)一律 `t.raw` 取,勿 `t()`(next-intl FORMATTING_ERROR/MISSING 陷阱,見 #248)。
- Commit:英文 Conventional Commits + `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`。
- 從 worktree 根執行:`/home/royfw/_/code/royfw/rfjs/.claude/worktrees/feat-table-builder-protocol-editor`。web 測試 `pnpm -F web exec vitest run <pattern>`(純子字串);型別 `pnpm -F web check-types`;lint `pnpm -F web lint`。fresh worktree 首次可能需 `pnpm install` + `pnpm build:packages`。

> **驗證修正(ultracode plan review,7 confirmed):** ① Task 2/3 型別半遷移 → **合併成單一 Task 2**(sample.ts + source-panel.tsx + ui.tsx 一起改,check-types 不對半套跑)② rename 打到 `ui.spec.tsx:69,129` 的 `"Fake fetcher"` + `source-panel.spec.tsx` 的 strategy/transport 舊區塊 → 納入 Task 2 一併改 ③ ~25 個 `tb*` protocol key 不存在 → **改重用既有 `mb*` key**(零新 key)④ 測試選取器 `.first?.()` 寫錯 → 用純 `getByRole`。

## 檔案結構

- `apps/web/src/components/protocol-panel/index.tsx`(新,`git mv` 自 metadata-builder)+ `index.spec.tsx`
- `apps/web/src/tools/metadata-builder/ui.tsx`(改 import)
- `apps/web/src/tools/table-builder/{sample.ts,ui.tsx,source-panel.tsx,messages.ts,ui.spec.tsx,source-panel.spec.tsx}`(收斂 + 編輯器 + 命名/i18n + 既有測試更新)

---

## Task 1 · 抽出共用 ProtocolPanel + showEnableToggle

**檔案:** `git mv` metadata-builder 的 `protocol-panel.tsx`/`.spec.tsx` → `apps/web/src/components/protocol-panel/index.tsx`/`index.spec.tsx`;改 `index.tsx`(加 prop);改 metadata-builder `ui.tsx` import;改 spec import。

**介面:** 產出 `@/components/protocol-panel` 的 `ProtocolPanel`(新增 `showEnableToggle?: boolean`,預設 true)+ `ProtocolPanelLabels`。

- [ ] **步驟 1:寫失敗測試**

在 `apps/web/src/tools/metadata-builder/protocol-panel.spec.tsx`(移動前)加一個 case(移動後路徑會變,先加在既有檔):
```tsx
it("hides the enable Switch when showEnableToggle is false, always shows fields", () => {
  render(<ProtocolPanel request={REQ} response={RES} onChange={() => {}} labels={LABELS} showEnableToggle={false} />);
  expect(screen.queryByRole("switch")).toBeNull();
  expect(screen.getByDisplayValue(REQ.endpoint)).toBeTruthy();
});
```
(`REQ`/`RES`/`LABELS` 沿用該 spec 既有 fixture。)

- [ ] **步驟 2:跑測試確認 FAIL**

執行:`pnpm -F web exec vitest run protocol-panel`
預期:FAIL —— 無 `showEnableToggle`,Switch 恆顯示。

- [ ] **步驟 3:git mv + 加 prop**

```bash
mkdir -p apps/web/src/components/protocol-panel
git mv apps/web/src/tools/metadata-builder/protocol-panel.tsx apps/web/src/components/protocol-panel/index.tsx
git mv apps/web/src/tools/metadata-builder/protocol-panel.spec.tsx apps/web/src/components/protocol-panel/index.spec.tsx
```
`index.tsx` 的 `ProtocolPanel` 加參數 `showEnableToggle = true`(型別見下),並:
- `const showFields = showEnableToggle ? enabled : request !== undefined && response !== undefined;`
- 把顯示 `<Switch>` 的那個 `<label>` 包在 `{showEnableToggle && (...)}` 內;
- 原 `{enabled && request && response && (...)}` 改成 `{showFields && request && response && (...)}`。
```tsx
export function ProtocolPanel({ request, response, onChange, labels, showEnableToggle = true }: {
  request: RequestMeta | undefined; response: ResponseMeta | undefined;
  onChange: (next: { request: RequestMeta | undefined; response: ResponseMeta | undefined }) => void;
  labels: ProtocolPanelLabels; showEnableToggle?: boolean;
}) {
```
> 讀 `index.tsx` 的 import:若有任何**相對** import(`./x`)因搬到 components/ 而失效,改成 `@/` 或修正路徑(移動前先確認;目前它只 import `@rfjs/*` 與 React,應無相對 import)。

- [ ] **步驟 4:改 import**

- `apps/web/src/tools/metadata-builder/ui.tsx:11`:`from "./protocol-panel"` → `from "@/components/protocol-panel"`。
- `index.spec.tsx` 內 `from "./protocol-panel"` → `from "./index"`(或 `.`)。
- grep 全 apps/web 確認沒有其他檔 import 舊路徑 `tools/metadata-builder/protocol-panel`。

- [ ] **步驟 5:跑測試 + 型別 PASS**

執行:`pnpm -F web exec vitest run protocol-panel metadata-builder` → PASS。
執行:`pnpm -F web check-types` → 無錯誤。

- [ ] **步驟 6:Commit**

```bash
git add -A apps/web/src/components/protocol-panel apps/web/src/tools/metadata-builder/ui.tsx
git commit -m "$(cat <<'EOF'
refactor(web): extract ProtocolPanel to shared component + showEnableToggle

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2 · table-builder:收斂 SourceMode + 內嵌 protocol 編輯器 + 命名/i18n(單一型別一致的任務)

> **合併**(原 Task 2+3):`SourceMode` 收斂與 source-panel 改動**必須同一任務**,否則 check-types 對半遷移的 tree 會失敗。所有 table-builder 檔一起改、一起驗。

**檔案:** 改 `apps/web/src/tools/table-builder/{sample.ts,source-panel.tsx,ui.tsx,messages.ts,source-panel.spec.tsx,ui.spec.tsx}`

**介面:** 消費 `@/components/protocol-panel`;`SourceMode = "rows" | "remote"`;table-builder 持有可編 `request`/`response`;protocolLabels **重用既有 `mb*` key**。

- [ ] **步驟 1:寫失敗測試(新增)**

(a) `ui.spec.tsx` 加(用純 `getByRole`,不用 `.first?.()`):
```tsx
it("remote mode renders the protocol editor with an editable endpoint", async () => {
  renderTool();
  fireEvent.click(screen.getByRole("button", { name: /remote|遠端/i }));
  expect(await screen.findByDisplayValue("/api/query/sample")).toBeTruthy();
});
```
> 若既有選 remote 的手法不同,依 ui.spec 慣例調整;endpoint 值 = `SAMPLE_META.request.endpoint`(現為 `/api/sample/items`?見步驟 3 會改成 `/api/query/sample`;斷言值與之一致)。

(b) `source-panel.spec.tsx` 加:
```tsx
it("fetcher toggle -> remote, no strategy row, transport labels from labels", () => {
  const onModeChange = vi.fn();
  render(<SourcePanel mode="rows" onModeChange={onModeChange} labels={FULL_LABELS} transport="memory" onTransportChange={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: FULL_LABELS.fetcher }));
  expect(onModeChange).toHaveBeenCalledWith("remote");
  expect(screen.queryByRole("button", { name: /^offset$/i })).toBeNull();
  render(<SourcePanel mode="remote" onModeChange={() => {}} labels={FULL_LABELS} transport="memory" onTransportChange={() => {}} />);
  expect(screen.getByRole("button", { name: FULL_LABELS.transportHttp })).toBeTruthy();
});
```
> `FULL_LABELS` = 含全部 `SourcePanelLabels` 欄位(含新 `transport`/`transportMemory`/`transportHttp`)的物件;就地宣告或改造既有 `baseLabels`。

- [ ] **步驟 2:跑測試確認 FAIL**

執行:`pnpm -F web exec vitest run source-panel table-builder`
預期:FAIL(無 protocol 編輯器 / fetcher 仍 call "offset" / transport 硬編)。

- [ ] **步驟 3:sample.ts —— 收斂型別 + 對齊 endpoint**

- `SourceMode`:`"rows" | "offset" | "page" | "cursor"` → `"rows" | "remote"`。
- **移除 `samplePaginationMeta`**(先 grep 確認移除後無殘引用;ui.tsx 的引用在步驟 5 一併去掉)。
- `SAMPLE_META.request.endpoint` `"/api/sample/items"` → `"/api/query/sample"`(對齊活的 route;method 維持;`SAMPLE_META.response` 的 `data.items`/`data.total` 已對)。

- [ ] **步驟 4:source-panel.tsx —— rows/remote + 移策略列 + transport i18n**

- `SourcePanelLabels` 加 `transport: string; transportMemory: string; transportHttp: string;`;**移除** `offset`/`page`/`cursor` 三個 label 欄位。
- fetcher 按鈕 `onClick` `"offset"` → `"remote"`;rows 不變。
- **刪除** `REMOTE_MODES` 常數 + 策略列整塊 JSX(`{isRemote ? (...策略列...) : null}`)。
- transport 那塊硬編 `Transport`/`in-memory`/`HTTP` → `{labels.transport}`/`{labels.transportMemory}`/`{labels.transportHttp}`。

- [ ] **步驟 5:ui.tsx —— 可編 state + 編輯器 + protocolLabels(重用 mb*)+ SourcePanel labels**

- import:`import { ProtocolPanel, type ProtocolPanelLabels } from "@/components/protocol-panel";`
- state(近 `sourceMode`):
  ```tsx
  const [request, setRequest] = React.useState<RequestMeta>(SAMPLE_META.request!);
  const [response, setResponse] = React.useState<ResponseMeta>(SAMPLE_META.response!);
  ```
- source useMemo(去掉 `samplePaginationMeta`;deps 加 request/response):
  ```tsx
  const source: TableSource = React.useMemo(() => {
    if (sourceMode === "rows") return { kind: "rows", rows };
    return { kind: "remote", request, response, fields: SAMPLE_META.fields,
      fetch: transport === "http" ? makeHttpFetcher(request) : makeFakeFetcher(SAMPLE_ROWS, config.columns, SAMPLE_META.fields) };
  }, [sourceMode, transport, request, response, config.columns, rows]);
  ```
- Metadata tab 輸入:`const metaRequest = sourceMode === "rows" ? undefined : request;` / `const metaResponse = sourceMode === "rows" ? undefined : response;`
- **protocolLabels 重用 `mb*`**(所有工具聚合成同一 ToolUI namespace,已驗證;`mbTryRows` 用 `t.raw`):
  ```tsx
  const protocolLabels: ProtocolPanelLabels = React.useMemo(() => ({
    enabled: t("mbProtoEnabled"), endpoint: t("mbEndpoint"), method: t("mbMethod"), pagination: t("mbPagination"),
    sort: t("mbSort"), sortNone: t("mbSortNone"), filter: t("mbFilter"), filterNone: t("mbFilterNone"), filterParam: t("mbFilterParam"),
    rowsPath: t("mbRowsPath"), totalPath: t("mbTotalPath"), cursorPath: t("mbCursorPath"),
    limitParam: t("mbLimitParam"), offsetParam: t("mbOffsetParam"), pageParam: t("mbPageParam"), pageSizeParam: t("mbPageSizeParam"),
    firstPage: t("mbFirstPage"), cursorParam: t("mbCursorParam"), sortParam: t("mbSortParam"), encoding: t("mbEncoding"),
    fieldParam: t("mbFieldParam"), dirParam: t("mbDirParam"),
    try: t("mbTry"), tryRows: t.raw("mbTryRows") as string, tryError: t("mbTryError"),
  }), [t]);
  ```
- SourcePanel 的 labels(在建 `SourcePanelLabels` 的 useMemo):`fetcher: t("tbSourceFetcher")`(值改見步驟 6);加 `transport: t("tbTransport"), transportMemory: t("tbTransportMemory"), transportHttp: t("tbTransportHttp")`;移除 offset/page/cursor。
- render:`<SourcePanel .../>` 之後、remote 時:
  ```tsx
  {sourceMode !== "rows" && (
    <ProtocolPanel request={request} response={response} showEnableToggle={false}
      onChange={(n) => { if (n.request) setRequest(n.request); if (n.response) setResponse(n.response); }}
      labels={protocolLabels} />
  )}
  ```
- `<SourcePanel mode={sourceMode} onModeChange={setSourceMode} ...>` 的型別自動變 rows/remote。ConfigTable 的 `key`(含 sourceMode)維持——**確認 key 不含 request/response**(否則編 endpoint 每次 keystroke 會 remount 掉焦點;現況 key = `${sourceMode}:${pageSize}:${dataVersion}`,不含 request,OK)。

- [ ] **步驟 6:messages.ts —— fetcher 改名 + transport keys**

- `tbSourceFetcher` 值 `"Fake fetcher"`/`"假 fetcher"` → `"Remote"`/`"遠端"`(key 名不動)。
- 新增 en:`tbTransport: "Transport", tbTransportMemory: "in-memory", tbTransportHttp: "HTTP",`;zh-TW:`tbTransport: "傳輸", tbTransportMemory: "記憶體", tbTransportHttp: "HTTP",`。
- 若原有 `tbSourceOffset/Page/Cursor`(策略 label)已無用 → 移除,並清掉 ui.tsx 對應 label 組裝。

- [ ] **步驟 7:更新既有測試(rename/i18n/型別打到的)**

- `ui.spec.tsx:69` 與 `:129`:`getByRole("button", { name: "Fake fetcher" })` → `name: "Remote"`(依實際 locale;en 測試用 "Remote")。
- `source-panel.spec.tsx`:
  - 既有 **strategy describe 區塊**(offset/page/cursor)→ 刪除或改寫成 rows/remote。
  - 既有 **transport toggle describe 區塊**:`mode="offset"` → `"remote"`;`baseLabels = {} as never` → 給一份含 transport 欄位的完整 labels;`getByRole(/http/i)` → `getByRole({ name: FULL_LABELS.transportHttp })`。

- [ ] **步驟 8:全量 table-builder 驗證**

執行:`pnpm -F web exec vitest run source-panel table-builder` → PASS。
執行:`pnpm -F web check-types` → 無錯誤(無 `samplePaginationMeta`/舊 SourceMode/舊 label 殘引用)。
執行:`pnpm -F web lint`(touched 檔)→ 無錯誤。

- [ ] **步驟 9:Commit**

```bash
git add apps/web/src/tools/table-builder/sample.ts apps/web/src/tools/table-builder/source-panel.tsx apps/web/src/tools/table-builder/ui.tsx apps/web/src/tools/table-builder/messages.ts apps/web/src/tools/table-builder/source-panel.spec.tsx apps/web/src/tools/table-builder/ui.spec.tsx
git commit -m "$(cat <<'EOF'
feat(web): table-builder embeds protocol editor (SourceMode rows/remote, i18n)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3 · 全量驗證 + 截圖

**檔案:** 無。

- [ ] **步驟 1:全量驗證**

執行:`pnpm -F web exec vitest run protocol-panel metadata-builder table-builder source-panel` → PASS。
執行:`pnpm -F web check-types` → 無錯誤。
執行:`pnpm -F web lint` → 無錯誤。

- [ ] **步驟 2:截圖(verify skill)**

worktree 起 dev(非 3000 埠)+ bundled chromium:
- table-builder:切 **Remote / 遠端** → 內嵌 ProtocolPanel(endpoint 等可編)+ Transport(i18n);改 endpoint、切 HTTP → Apply/翻頁仍打得到(network 依 method GET/POST)。
- metadata-builder:protocol 面板外觀/試打**不變**(抽出回歸)。
存 scratchpad,回報路徑。

- [ ] **步驟 3:HOLD** —— 不 push、不開 PR。回報分支狀態 + 截圖。

---

## 自我檢查

**Spec 覆蓋:** 抽出+showEnableToggle(T1)、收斂+編輯器+命名+i18n+既有測試(T2)、驗證/截圖(T3)。✅
**Placeholder:** 無 TBD;每 code 步驟有 code(T1 mv 為明確指令)。✅
**型別一致:** `SourceMode="rows"|"remote"` 的所有消費者(sample.ts/source-panel.tsx/ui.tsx/ui.spec/source-panel.spec)都在 **同一個 Task 2** 內一起改 → check-types 不對半套 tree 跑(修 finding #1)。`showEnableToggle` T1 定義、T2 使用一致。protocolLabels 全部 key 都是**既有 `mb*`**(修 finding #3,零新 key)。
**已知注意:**
1. **既有測試**:`ui.spec.tsx:69,129` 的 "Fake fetcher"、`source-panel.spec.tsx` 的 strategy/transport 舊區塊,都在 T2 步驟 7 更新(修 finding #2/#4/#6/#7)。
2. **選取器**:remote 用純 `getByRole`,不用 `.first?.()`(修 finding #5)。
3. **i18n {count}**:`mbTryRows` 走 `t.raw`。
4. **protocolLabels 重用 mb\***:table-builder 依賴 metadata-builder 的 mb* protocol key(同 ToolUI namespace);屬刻意共用(ProtocolPanel 已共用)。未來若要中性化 key(mb*→proto*)是另一輪小 cleanup。
5. **ConfigTable key** 不含 request/response,避免編 endpoint 時 remount 掉焦點。
6. metadata-builder 抽出後外觀/試打不變(T1 測試 + T3 截圖回歸)。
