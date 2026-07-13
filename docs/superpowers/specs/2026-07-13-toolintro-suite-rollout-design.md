# ToolIntro 全套件推廣 — 設計

- 日期:2026-07-13
- 狀態:設計待審
- 前置:`<ToolIntro>`(#251)+ restore-persist 修復(#252)已在 main
- 範圍:apps/web only

## 一句話

把既有的共用 `<ToolIntro>`(V1 摺疊 callout)從目前僅有的 2 個工具推廣到其餘 15 個 surface:'web' 工具(排除 flow-builder / bpmn-viewer —— 歸 BPM 專案),並把 intro 的**控制文案**收斂成單一共用來源。

## 現況

- `<ToolIntro storageKey question tagline? concepts[] labels{expand,collapse,dismiss} dismissible?>`(`apps/web/src/components/shared/tool-intro.tsx`)已接進 table-builder + metadata-builder(eyebrow 後)。
- 全部工具都用 `useTranslations("ToolUI")`;訊息經 `assembleMessages` 把中央 `messages/{en,zh-TW}.json`(已有 `ToolUI` 區塊)+ 各工具 fragment deep-merge —— 所以中央定義的 key 每個工具頁都拿得到。
- 掛載點不統一:只有 decision-table 有 eyebrow;6 個工具用 `<ToolShell operation input output>`(無 intro 槽),9 個自排版。

## 設計決定

### 1. 共用控制文案(單一來源)
在中央 `messages/{en,zh-TW}.json` 的 `ToolUI` 加 4 個 key:
- `introQuestion` = "How does this tool work?" / "這個工具怎麼運作?"
- `introExpand` = "Expand" / "展開"
- `introCollapse` = "Collapse" / "收合"
- `introDismiss` = "Dismiss" / "關閉"

15 個新工具與**既有 table-builder / metadata-builder** 全部改用這組;移除 table-builder fragment 內的 `tbIntroQuestion/tbIntroExpand/tbIntroCollapse/tbIntroDismiss`(mb 本來就是重用 tb 的,改指 `intro*` 即可)。各工具的 **tagline + concepts** 仍是各自的 key(見 §掛載),不集中。

### 2. 掛載規則(零判斷、ToolShell 不動)
每工具把現有 `return (…)` 的根元素**統一包一層**:
```tsx
return (
  <div className="flex flex-col gap-4">
    <ToolIntro
      storageKey="tool-intro:<id>"
      question={t("introQuestion")}
      tagline={t("<x>IntroTagline")}
      concepts={[
        { term: t("<x>IntroC1t"), desc: t("<x>IntroC1d") },
        { term: t("<x>IntroC2t"), desc: t("<x>IntroC2d") },
        // 第三個 concept 視工具而定
      ]}
      labels={{ expand: t("introExpand"), collapse: t("introCollapse"), dismiss: t("introDismiss") }}
    />
    {/* ↓ 原本的 return 根元素,原封不動 */}
  </div>
);
```
不改 `<ToolShell>` 的 API(它被 6 個工具共用,零波及)。`<x>` = 各工具的既有 key 前綴(見下表 prefix 欄)。既有 table-builder / metadata-builder 維持原本「eyebrow 後」的擺法,只改控制 key 來源。

### 3. 各工具文案(prefix + tagline + concepts;en / zh-TW)

> concept term 用 ①②③ 前綴維持與 table-builder 一致的視覺。以下 key 加到各工具 `messages.ts` 的 `ToolUI`(en 與 zh-TW 皆須)。

| 工具(prefix) | tagline | concepts(term — desc) |
|---|---|---|
| **data-filter-builder** (`dfb`) | 建一棵篩選樹 → 即時符合的資料列 / Build a filter tree → matched rows, live | ① 建構 —— 巢狀 and/or/not 群組 + 欄位條件 / Nest and/or/not groups with field conditions ② 比對 —— @rfjs/data-filter 在記憶體對範例 JSON 求值 / @rfjs/data-filter evaluates it over the sample JSON in memory ③ 即時 —— 邊編邊看符合的列更新 / matched rows update as you edit |
| **sql-filter-builder** (`sfb`) | 建一棵篩選樹 → 參數化 SQL / Build a filter tree → parameterized SQL | ① 建構 —— 對純欄位巢狀 and/or/not / Nest and/or/not over plain columns ② 編譯 —— @rfjs/sql-filter 產出參數化 WHERE + 值(零注入)/ @rfjs/sql-filter emits a parameterized WHERE + values (zero injection) ③ 即時 —— 編出的 SQL 即時更新 / the compiled SQL updates live |
| **jsonb-query-builder** (`jqb`) | 建一棵篩選樹 → PostgreSQL JSONB WHERE / Build a filter tree → PostgreSQL JSONB WHERE | ① 建構 —— 條件指向 JSONB 欄的路徑 / conditions target paths into a JSONB column ② 編譯 —— @rfjs/jsonb-query 產出 WHERE/ORDER BY / @rfjs/jsonb-query emits the WHERE/ORDER BY ③ 即時 —— 編出的 SQL 即時更新 / the compiled SQL updates live |
| **mongo-query-builder** (`mqb`) | 建一棵篩選樹 → MongoDB 查詢物件 / Build a filter tree → MongoDB query object | ① 建構 —— 巢狀 and/or/not + 欄位條件 / Nest and/or/not groups with field conditions ② 編譯 —— @rfjs/mongo-query 產出查詢物件 / @rfjs/mongo-query emits the query object ③ 即時 —— 編出的查詢即時更新 / the compiled query updates live |
| **es-query-builder** (`eqb`) | 建一棵篩選樹 → Elasticsearch / OpenSearch bool 查詢 / Build a filter tree → Elasticsearch / OpenSearch bool query | ① 建構 —— 巢狀 and/or/not + 欄位條件 / Nest and/or/not groups with field conditions ② 編譯 —— @rfjs/es-query 產出 ES 與 OpenSearch 通用的 bool 查詢 / @rfjs/es-query emits a bool query valid for both ③ 即時 —— 編出的查詢即時更新 / the compiled query updates live |
| **pg-filter-builder** (`pfb`) | 一棵樹混欄位 + JSONB → 統一 PostgreSQL WHERE / One tree, columns + JSONB → unified PostgreSQL WHERE | ① 建構 —— 同一棵樹混「純欄位」與「JSONB 路徑」條件 / a single tree mixes plain-column and JSONB-path conditions ② 編譯 —— @rfjs/pg-filter(sql-filter + jsonb-query)產出單一 WHERE / @rfjs/pg-filter emits one unified WHERE ③ 即時 —— 統一的 SQL 即時更新 / the unified SQL updates live |
| **jsonb-query-generator** (`jqg`) | 篩選 metadata → PostgreSQL JSONB 查詢 / Filter metadata → PostgreSQL JSONB query | ① 描述 —— 給篩選 metadata(欄位、運算子、值)/ supply filter metadata (fields, operators, values) ② 產生 —— @rfjs/jsonb-query 編成 JSONB WHERE/ORDER BY / @rfjs/jsonb-query compiles it to a JSONB WHERE/ORDER BY |
| **mongo-query-generator** (`mqg`) | 篩選 metadata → MongoDB 查詢 / Filter metadata → MongoDB query | ① 描述 —— 給篩選 metadata(欄位、運算子、值)/ supply filter metadata (fields, operators, values) ② 產生 —— @rfjs/mongo-query 編成查詢物件 / @rfjs/mongo-query compiles it to a query object |
| **data-filter-tester** (`dft`) | 拿 @rfjs/data-filter 條件對範例資料試跑 / Test @rfjs/data-filter conditions against sample data | ① 撰寫 —— 一條 data-filter 條件(JSONPath 風格)/ a data-filter condition (JSONPath-style) ② 試跑 —— 對範例資料即時求值 / evaluates against the sample data live ③ 即時 —— 邊打邊看符合結果 / matched results update as you type |
| **es-client-demo** (`ecd`) | 篩選 → ES 搜尋 body → 實跑(mock transport)/ Filter → ES search body → run it (mock transport) | ① 建構 —— 建篩選 → 編成 ES/OpenSearch 搜尋 body / a filter, compiled to an ES / OpenSearch search body ② 執行 —— @rfjs/es-client 用 mock transport 真的對範例資料執行 / @rfjs/es-client runs it over a mock transport that truly filters the sample data ③ 檢視 —— 搜尋 · 分頁 · 高亮 / search · paginate · highlight |
| **jwt-decoder** (`jwt`) | 貼一個 JWT → header + payload + 即時有效期 / Paste a JWT → header + payload + live expiry | ① 貼上 —— JWT 字串 / a JWT string ② 解碼 —— @rfjs/jwt 拆解並解碼 header + payload(不驗簽)/ @rfjs/jwt splits and decodes the header + payload (no verification) ③ 有效期 —— 徽章依 `exp` 即時跳動 / a live expiry chip ticks against `exp` |
| **object-flatten** (`of`) | 巢狀物件 ⇄ 點路徑鍵 / Nested object ⇄ dot-path keys | ① 壓平 —— @rfjs/object-utils 把巢狀物件變成 `a.b.c` 鍵 / turns nested objects into `a.b.c` keys ② 還原 —— 也能反向還原,來回往返 / and back again, round-trip |
| **type-converter** (`tc`) | 在 string / number / boolean / date 間轉換值 / Convert a value between string / number / boolean / date | ① 選擇 —— 來源值與目標型別 / a source value and a target type ② 轉換 —— @rfjs/data-transform 轉換並即時顯示結果 / @rfjs/data-transform coerces it, showing the result live |
| **form-builder** (`fb`) | 在 12 欄格線拖欄位 → 即時表單預覽 / Drag fields on a 12-column grid → live form preview | ① 佈局 —— 把欄位/內容拖上 12 欄格線、分組 / drag fields/content onto a 12-column grid, group them ② 設定 —— 逐欄設型別、驗證、規則、資料來源 / set per-field type, validation, rules, data source ③ 預覽 —— 即時預覽表單與其結果 / the live form (and its result) renders as you build |
| **decision-table** (`dt`) | DMN 式規則(篩選樹)→ 即時求值 / DMN-style rules (filter trees) → evaluate live | ① 編寫 —— 每列是規則,條件是巢狀篩選樹,輸出是常數或運算式 / rows are rules whose conditions are nested filter trees; outputs are constants or expressions ② 求值 —— 對單一 context 或整批求值 / run one context or a whole batch ③ 即時 —— 看命中規則與輸出 / matched rule + output, live |

> prefix 命名跟隨各工具 messages.ts 既有慣例(如 decision-table 用 `dt*`、es-client-demo 用 `ecd*`);實作時以該檔既有前綴為準,上表僅示意。

## 變更清單(apps/web only)

- **中央 messages**:`messages/en.json` + `messages/zh-TW.json` 的 `ToolUI` 加 `introQuestion/introExpand/introCollapse/introDismiss`。
- **15 個工具**:各 `messages.ts` 加該工具的 `<x>IntroTagline` + concept keys(en+zh-TW);各 `ui.tsx` 依 §2 包一層 `<ToolIntro>`;各 `ui.spec.tsx` 加一則接線斷言(見測試)。
- **既有 2 工具遷移**:table-builder / metadata-builder 的 ToolIntro 控制 key 改指 `intro*`;移除 tb 的 4 個 `tbIntro*` 控制 key(concept/tagline 保留)。
- changeset:`web` patch 一份。

## 測試
- **元件行為**(展開/摺疊/dismiss/localStorage)已由 `tool-intro.spec.tsx` 覆蓋 —— **不重複**。
- **每工具接線**:在該工具既有 `ui.spec.tsx` 加一則:mount 後 `getByRole("button", { name: /how does this tool work/i })` 存在(證明已接線);若某工具無 ui.spec,補一個最小的。
- 遷移的 2 工具:既有 intro 展開測試斷言的是**渲染文字**(concept desc / question),key 換來源不影響 —— 應維持綠。
- `pnpm -F web test && check-types && lint` 全綠。

## 明確不做
- 不接 flow-builder / bpmn-viewer(BPM 專案)、object-transformer(workbench surface)。
- 不改 `<ToolShell>` API、不改 `<ToolIntro>` 元件本身。
- 不做視覺統一輪(另一輪 deferred;且會撞本輪的 ui.tsx)。
- concept 文案不進 registry、不集中(除控制 4 key 外各工具自帶)。

## 驗收
- 15 工具頁皆顯示可摺疊的 intro,展開見概念格;en + zh-TW 皆正確。
- 既有 table-builder / metadata-builder 行為不變(控制 key 換來源、無視覺變化)。
- 截圖:數個代表工具的收合 + 展開態(含一個 ToolShell 系、一個 custom 系)、dark/light 各一。
