# table-builder 內嵌 protocol 編輯器(extract-and-share ProtocolPanel)— 設計 spec

- 日期:2026-07-11
- 分支 / worktree:`feat-table-builder-protocol-editor` @ `.claude/worktrees/feat-table-builder-protocol-editor`(off main `f2d0766`,含 #248)
- 背景:#248 給了 table-builder HTTP transport,但**沒有 endpoint/protocol 配置面**(全寫死在 `SAMPLE_META`);gap 盤點(Explore)確認:table-builder 無 protocol UI、source-panel 命名/i18n 有誤導。
- 範圍決策(與使用者):**選 B——內嵌 protocol 編輯器**,且做法是**抽出 metadata-builder 的 `ProtocolPanel` 成共用元件、兩工具共用**(不重刻)。
- 狀態:設計已確認方向,待 spec review → plan

---

## 1. 背景與目標

table-builder 的 source 面板目前只讓使用者選:rows vs fetcher、以及 strategy(offset/page/cursor)、transport(memory/HTTP)——但 endpoint / method / 各 param 名 / rowsPath 等**全寫死在 `SAMPLE_META`**(`sample.ts`),UI 零輸入。而 metadata-builder 的 `protocol-panel.tsx` 早就把這些做成可編。

**目標(B):**
- **抽出** `ProtocolPanel`(含子件/labels/defaults)成 apps/web 共用元件,metadata-builder 改 import(行為不變,含 #248 的 try-endpoint 鈕)。
- **table-builder** 新增可編 `request`/`response` 狀態,remote 時渲染共用 ProtocolPanel;remote source 的 endpoint/method/分頁/response 改**吃編輯狀態**;HTTP fetcher 用編輯後的 request(已是 #248 的擬真 `makeHttpFetcher(request)`)。
- **修命名 + i18n**:「假 fetcher」誤導、Transport 那排硬編英文。

---

## 2. 非目標(out of scope)

- **不做 meta.json import**(那是 A 案;本輪走 in-tool 編輯)。可留候選。
- **不做視覺一致性/佈局大改**(向 metadata-studio 靠攏那輪,另開)。
- **不改 `packages/*`**:ProtocolPanel 是 app-level,抽到 apps/web 共用夾。
- AI assist 的 request/response NL(gap #12)、route 旋鈕的 UI(gap #13)——本輪不做,留註記。

---

## 3. 抽出:共用 ProtocolPanel

從 `apps/web/src/tools/metadata-builder/protocol-panel.tsx` **整包**抽到 `apps/web/src/components/protocol-panel/`(index.tsx):含 `ProtocolPanelLabels`、`Seg`/`LabeledText` 子件、`DEFAULT_REQUEST`/`DEFAULT_RESPONSE`、`ProtocolPanel`(含 #248 的 try-endpoint 狀態/runTry)。

- metadata-builder 改 `import { ProtocolPanel, type ProtocolPanelLabels } from "@/components/protocol-panel"`(其 `ui.tsx`/spec 一併改 import)。**行為與外觀不變**。
- **`enabled` 語意調整**:目前 `enabled = request && response`,並用 `<Switch>` 開/關(關 → request/response 設 undefined)。加一個 prop `showEnableToggle?: boolean`(預設 `true`,metadata-builder 維持 toggle);table-builder 傳 `false`——remote 時 protocol 恆在、不顯示 toggle(request/response 恆有值)。

---

## 4. table-builder 接入

**source 模型收斂(核心決策,見 §7 風險):** 目前 `SourceMode = "rows" | "offset" | "page" | "cursor"` 把「rows vs remote」和「分頁策略」混在一起。本輪把它**收斂成 `"rows" | "remote"`**;分頁策略移交 ProtocolPanel 的 `pagination.strategy` 欄位(它本來就能選 offset/page/cursor 並 rebuild 預設 param 名)。移除 source-panel 的策略 toggle(`REMOTE_MODES`)。

- **狀態**:table-builder 新增 `request: RequestMeta` / `response: ResponseMeta`(初始 seed 自 `SAMPLE_META.request`/`.response`,但變成可編 state)。
- **source-panel**:`rows`/`remote` 切換;`remote` 時展開共用 `<ProtocolPanel request response onChange showEnableToggle={false} labels>` + 保留 transport(memory/HTTP)toggle。
- **source memo(ui.tsx)**:`remote` 分支的 `request`/`response` 用編輯 state;`fetch = transport==='http' ? makeHttpFetcher(request) : makeFakeFetcher(SAMPLE_ROWS, config.columns, request 的 fields?)`。in-memory fake 仍吃 rows。
- **Metadata tab**:改顯示編輯後的 `request`/`response`(而非固定 `SAMPLE_META`),與 protocol 編輯即時同步。
- **labels**:table-builder 建一份 `ProtocolPanelLabels`(自 messages 的 `tb*` 或複用),含 try-endpoint 字串(記得 `{count}` 走 `t.raw`,同 #248)。

---

## 5. 命名 + i18n 修正

- `messages.ts` `tbSourceFetcher` `"Fake fetcher"`/`"假 fetcher"` → 不誤導的名(如 `"Remote"`/`"遠端"` 或 `"Fetcher"`/`"擷取"`)。同步 key 名可留 `tbSourceFetcher`(值改)。
- **Transport toggle i18n 化**:`SourcePanelLabels` 加 `transport`/`transportMemory`/`transportHttp`,`messages.ts` 補 en + zh-TW,source-panel 的硬編 `Transport`/`in-memory`/`HTTP` 改吃 labels。

---

## 6. 紅線 / changeset

- **不改 `packages/*`**。ProtocolPanel 抽到 `apps/web/src/components/`(app-level 共用)。
- **無 changeset**(只動 apps/web)。
- commits 英文 conventional + trailer;spec/plan 繁中。

---

## 7. 風險與待決

1. **SourceMode 收斂(rows/offset/page/cursor → rows/remote)是最大風險**:牽動 `sample.ts`(`SourceMode` 型別、`samplePaginationMeta`)、`ui.tsx`(source memo 現用 sourceMode 決定 pagination)、`source-panel.tsx`、Metadata tab、以及既有 source-panel/ui/table-builder 測試。策略改由 ProtocolPanel 擁有。**替代案**:保留策略 toggle 當快捷、與 `request.pagination.strategy` 同步(但會與 ProtocolPanel 的策略選擇重複)。本 spec 採「收斂」;若嫌動太大可退替代案。
2. **ProtocolPanel 抽出後 metadata-builder 測試**:`protocol-panel.spec.tsx`(含 #248 的 try test)要移到新位置或改 import;metadata-builder `ui.spec` 的 import 路徑跟改。
3. **enable toggle 調整**:加 `showEnableToggle` 後,metadata-builder 既有「both-or-nothing」行為與測試需維持;table-builder 走「恆在」路徑。
4. **fake fetcher 的 fields**:`makeFakeFetcher` 需要 fields 挑 sort comparator;改成可編 request 後,fields 仍來自 `SAMPLE_META.fields`(欄位本身這輪不做可編,維持 sample)。
5. **與後續視覺輪**:本輪動 source-panel/ui;視覺輪也會動——本輪先落地,視覺輪 rebase。
