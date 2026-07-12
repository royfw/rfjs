# ToolIntro 全套件推廣 — 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把共用 `<ToolIntro>` 推廣到 15 個 surface:'web' 工具,並把 intro 控制文案收斂成中央共用 key。

**Architecture:** 中央 `messages` 加 4 個共用控制 key;既有 table-builder/metadata-builder 遷移到它們;15 個工具各自加「tagline + concepts」key(唯一前綴)並在 ui.tsx 把 return 根包一層 `<ToolIntro>`。純 apps/web,無元件/ToolShell API 變更。

**Tech Stack:** Next.js 16、next-intl(扁平 `ToolUI` namespace,`assembleMessages` deep-merge 中央 + 各 fragment)、Vitest + @testing-library/react。

**Spec:** `docs/superpowers/specs/2026-07-13-toolintro-suite-rollout-design.md`

## Global Constraints

- Worktree:`/home/royfw/_/code/royfw/rfjs/.claude/worktrees/feat-toolintro-rollout`(branch `feat-toolintro-rollout`,基於最新 main)。所有指令在此。
- **ToolUI 是扁平共用 namespace**:所有工具 fragment 的 key deep-merge 進同一個 `ToolUI` 物件 → **每工具的 intro key 必須用唯一前綴**(見下方前綴表),否則互相覆蓋。控制 4 key(`introQuestion/introExpand/introCollapse/introDismiss`)刻意共用、只定義一次(中央)。
- 只動 `apps/web`;changeset:`web` patch 一份(Task 6)。
- Commit 英文 conventional commits,header ≤100 字元,trailer:`Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`。
- 每工具 fragment 的 en 與 zh-TW key 集合**必須相同**(缺一邊會讓該 locale 執行期崩)。
- 接線測試斷言鎖「展開後才出現、且全頁唯一」的字串(concept desc);**不要**斷 tagline(收合時就可見 → 空洞)。用純子字串 vitest filter,勿加字面 `--`。
- pre-commit hook 跑 `turbo run lint-staged test --affected`,commit 慢屬正常;不得 `--no-verify`。
- 不開 PR、不 push —— 完成後 HOLD,等使用者說「PR」。

## 每工具唯一 intro 前綴(權威表)

| 工具 id | 前綴 | storageKey |
|---|---|---|
| data-filter-builder | `dfbIntro` | tool-intro:data-filter-builder |
| sql-filter-builder | `sfbIntro` | tool-intro:sql-filter-builder |
| jsonb-query-builder | `jqbIntro` | tool-intro:jsonb-query-builder |
| mongo-query-builder | `mqbIntro` | tool-intro:mongo-query-builder |
| es-query-builder | `eqbIntro` | tool-intro:es-query-builder |
| pg-filter-builder | `pfbIntro` | tool-intro:pg-filter-builder |
| jsonb-query-generator | `jqgIntro` | tool-intro:jsonb-query-generator |
| mongo-query-generator | `mqgIntro` | tool-intro:mongo-query-generator |
| data-filter-tester | `dftIntro` | tool-intro:data-filter-tester |
| es-client-demo | `ecdIntro` | tool-intro:es-client-demo |
| jwt-decoder | `jwtIntro` | tool-intro:jwt-decoder |
| object-flatten | `oflIntro` | tool-intro:object-flatten |
| type-converter | `tcvIntro` | tool-intro:type-converter |
| form-builder | `fblIntro` | tool-intro:form-builder |
| decision-table | `dctIntro` | tool-intro:decision-table |

每工具的 key 名 = `<前綴>Tagline` / `<前綴>C1t` / `<前綴>C1d` / `<前綴>C2t` / `<前綴>C2d`(+ 有第三個 concept 則 `C3t`/`C3d`)。

## 每工具 ui.tsx 套用配方(所有工具一致)

在該工具 `ui.tsx`:
1. 加 import:`import { ToolIntro } from "@/components/shared/tool-intro";`
2. 把 `return (` 之後的**現有根元素**整個包進一層(ToolIntro 當第一個 child):
```tsx
  return (
    <div className="flex flex-col gap-4">
      <ToolIntro
        storageKey="tool-intro:<id>"
        question={t("introQuestion")}
        tagline={t("<前綴>Tagline")}
        concepts={[
          { term: t("<前綴>C1t"), desc: t("<前綴>C1d") },
          { term: t("<前綴>C2t"), desc: t("<前綴>C2d") },
          // 若有第三個:{ term: t("<前綴>C3t"), desc: t("<前綴>C3d") },
        ]}
        labels={{ expand: t("introExpand"), collapse: t("introCollapse"), dismiss: t("introDismiss") }}
      />
      {/* 原本的根元素,原封搬進來 */}
    </div>
  );
```
(該工具已用 `const t = useTranslations("ToolUI")` —— 全 15 個都是,無需新增。ToolShell 系工具也照包,intro 落在 ToolShell 上方。)

## 每工具 ui.spec.tsx 接線斷言配方

接線斷言鎖 ToolIntro 的按鈕名 `introQuestion`(= "How does this tool work?")。**`introQuestion` 是中央-only key(Task 1 只加進 `messages/*.json`),不在任何工具 fragment 裡** —— 所以 render 的 provider **必須**餵 `assembleMessages("en")`(deep-merge 中央 + fragment);用工具本地 `messages.en` fragment 會讓按鈕名退化成字面 `ToolUI.introQuestion`、斷言必掛。**不要**靠「把 introQuestion 加進工具 fragment」繞過。三種情況:

**(a) 既有 ui.spec 且已用 `assembleMessages("en")`(被接線工具中除 es-client-demo 外皆是)**:主 describe 內加一則,沿用該檔既有 render helper:
```tsx
  it("renders the collapsible ToolIntro", () => {
    <renderHelper>();
    expect(screen.getByRole("button", { name: /how does this tool work/i })).toBeTruthy();
  });
```

**(b) es-client-demo —— 既有 ui.spec 用本地 fragment**:先把 provider 遷到中央合併訊息,再加斷言:
- `es-client-demo/ui.spec.tsx:11` 的 `messages={messages.en as Record<string, unknown>}` → `messages={assembleMessages("en")}`;
- 檔頂 `import { messages } from "./messages";` → `import { assembleMessages } from "@/i18n/messages";`(`messages` 若無其他引用須移除,否則 lint 掛未用 import);
- assembleMessages 仍含 es-client-demo fragment,既有 "Fields"/"Search body"/"paginate" 斷言不受影響。

**(c) 無 ui.spec 的 6 個工具(jsonb-query-generator / mongo-query-generator / data-filter-tester / jwt-decoder / object-flatten / type-converter)**:各建一個最小 spec,provider **必須** `assembleMessages("en")`(勿抄 es-client-demo / bpmn-viewer / flow-builder 的本地 fragment 寫法):
```tsx
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import { assembleMessages } from "@/i18n/messages";
import { <ToolComponent> } from "./ui";

describe("<ToolComponent>", () => {
  it("renders the collapsible ToolIntro", () => {
    render(
      <NextIntlClientProvider locale="en" messages={assembleMessages("en")}>
        <<ToolComponent> />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("button", { name: /how does this tool work/i })).toBeTruthy();
  });
});
```
(`<ToolComponent>` = 該工具 ui.tsx 的 export 名;若 render 另需 mock(如 AI）沿用同家族既有 spec 的 mock,但 message provider 一律 `assembleMessages("en")`。)

---

### Task 0: Worktree setup(controller 可直跑)

- [ ] **Step 1:** `cd` 到 worktree,`pnpm install` → `pnpm build:packages` → `pnpm -F web test 2>&1 | grep -E "Test Files|Tests "`。Expected:install/build 成功;web 基線全綠。

---

### Task 1: 中央控制 key + 遷移 table-builder / metadata-builder

**Files:**
- Modify: `apps/web/src/messages/en.json`、`apps/web/src/messages/zh-TW.json`(`ToolUI` 加 4 key)
- Modify: `apps/web/src/tools/table-builder/messages.ts`(移除 4 個 `tbIntro` 控制 key)、`apps/web/src/tools/table-builder/ui.tsx`、`apps/web/src/tools/metadata-builder/ui.tsx`(控制 key 改指 `intro*`)

**Interfaces:**
- Produces:中央 `ToolUI.introQuestion/introExpand/introCollapse/introDismiss`(Task 2–5 每工具消費);遷移後既有 2 工具用共用控制 key。

- [ ] **Step 1: 加中央控制 key**

`messages/en.json` 的 `"ToolUI": {` 內加:
```json
    "introQuestion": "How does this tool work?",
    "introExpand": "Expand",
    "introCollapse": "Collapse",
    "introDismiss": "Dismiss",
```
`messages/zh-TW.json` 的 `"ToolUI": {` 內加:
```json
    "introQuestion": "這個工具怎麼運作?",
    "introExpand": "展開",
    "introCollapse": "收合",
    "introDismiss": "關閉",
```

- [ ] **Step 2: 遷移 table-builder**

`tools/table-builder/messages.ts`:en 與 zh-TW 各移除 `tbIntroQuestion`、`tbIntroExpand`、`tbIntroCollapse`、`tbIntroDismiss` 四行(保留 `tbIntroTagline` 與 `tbIntroC1t…C3d`)。
`tools/table-builder/ui.tsx` 的 `<ToolIntro>`:`question={t("tbIntroQuestion")}` → `question={t("introQuestion")}`;`labels={{ expand: t("tbIntroExpand"), collapse: t("tbIntroCollapse"), dismiss: t("tbIntroDismiss") }}` → `labels={{ expand: t("introExpand"), collapse: t("introCollapse"), dismiss: t("introDismiss") }}`。

- [ ] **Step 3: 遷移 metadata-builder**

`tools/metadata-builder/ui.tsx` 的 `<ToolIntro>`:同 Step 2 把 `question` 與 `labels` 由 `tbIntro*` 改指 `intro*`(mb 本來就重用 tb 的控制 key,故 mb messages.ts 無 key 需移除)。

- [ ] **Step 4: 驗證**

Run: `pnpm -F web exec vitest run src/tools/table-builder/ui src/tools/metadata-builder/ui && pnpm -F web check-types`
Expected:兩工具既有 intro 展開測試(斷渲染文字)仍 PASS;types 乾淨。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/messages apps/web/src/tools/table-builder apps/web/src/tools/metadata-builder
git commit -m "refactor(web): shared ToolIntro control strings in central ToolUI messages

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: 接線 filter-tree builders(data-filter-builder / sql-filter-builder / jsonb-query-builder / pg-filter-builder)

**Files(每工具):** `tools/<id>/messages.ts`、`tools/<id>/ui.tsx`、`tools/<id>/ui.spec.tsx`。
**Interfaces:** Consumes:Task 1 的中央控制 key + `@/components/shared/tool-intro`。

對這 4 個工具**各自**套用「ui.tsx 配方」+「ui.spec 配方」,並在各 `messages.ts` 的 `ToolUI`(en 與 zh-TW 皆須)加下列 key。

- [ ] **Step 1–4:** 逐工具加 key + 套配方。各工具文案:

**data-filter-builder(前綴 `dfbIntro`):**
en:
```json
"dfbIntroTagline": "Build a filter tree → matched rows, live",
"dfbIntroC1t": "① Build", "dfbIntroC1d": "Nest and/or/not groups with field conditions.",
"dfbIntroC2t": "② Match", "dfbIntroC2d": "@rfjs/data-filter evaluates it over the sample JSON in memory.",
"dfbIntroC3t": "③ Live", "dfbIntroC3d": "Matching rows update as you edit."
```
zh-TW:
```json
"dfbIntroTagline": "建一棵篩選樹 → 即時符合的資料列",
"dfbIntroC1t": "① 建構", "dfbIntroC1d": "巢狀 and/or/not 群組 + 欄位條件。",
"dfbIntroC2t": "② 比對", "dfbIntroC2d": "@rfjs/data-filter 在記憶體對範例 JSON 求值。",
"dfbIntroC3t": "③ 即時", "dfbIntroC3d": "邊編邊看符合的列更新。"
```

**sql-filter-builder(前綴 `sfbIntro`):**
en:
```json
"sfbIntroTagline": "Build a filter tree → parameterized SQL",
"sfbIntroC1t": "① Build", "sfbIntroC1d": "Nest and/or/not groups over plain columns.",
"sfbIntroC2t": "② Compile", "sfbIntroC2d": "@rfjs/sql-filter emits a parameterized WHERE + values (zero injection).",
"sfbIntroC3t": "③ Live", "sfbIntroC3d": "The compiled SQL updates live."
```
zh-TW:
```json
"sfbIntroTagline": "建一棵篩選樹 → 參數化 SQL",
"sfbIntroC1t": "① 建構", "sfbIntroC1d": "對純欄位巢狀 and/or/not。",
"sfbIntroC2t": "② 編譯", "sfbIntroC2d": "@rfjs/sql-filter 產出參數化 WHERE + 值(零注入)。",
"sfbIntroC3t": "③ 即時", "sfbIntroC3d": "編出的 SQL 即時更新。"
```

**jsonb-query-builder(前綴 `jqbIntro`):**
en:
```json
"jqbIntroTagline": "Build a filter tree → PostgreSQL JSONB WHERE",
"jqbIntroC1t": "① Build", "jqbIntroC1d": "Conditions target paths into a JSONB column.",
"jqbIntroC2t": "② Compile", "jqbIntroC2d": "@rfjs/jsonb-query emits the WHERE / ORDER BY.",
"jqbIntroC3t": "③ Live", "jqbIntroC3d": "The compiled SQL updates live."
```
zh-TW:
```json
"jqbIntroTagline": "建一棵篩選樹 → PostgreSQL JSONB WHERE",
"jqbIntroC1t": "① 建構", "jqbIntroC1d": "條件指向 JSONB 欄的路徑。",
"jqbIntroC2t": "② 編譯", "jqbIntroC2d": "@rfjs/jsonb-query 產出 WHERE / ORDER BY。",
"jqbIntroC3t": "③ 即時", "jqbIntroC3d": "編出的 SQL 即時更新。"
```

**pg-filter-builder(前綴 `pfbIntro`):**
en:
```json
"pfbIntroTagline": "One tree, columns + JSONB → unified PostgreSQL WHERE",
"pfbIntroC1t": "① Build", "pfbIntroC1d": "A single tree mixes plain-column and JSONB-path conditions.",
"pfbIntroC2t": "② Compile", "pfbIntroC2d": "@rfjs/pg-filter (sql-filter + jsonb-query) emits one unified WHERE.",
"pfbIntroC3t": "③ Live", "pfbIntroC3d": "The unified SQL updates live."
```
zh-TW:
```json
"pfbIntroTagline": "一棵樹混欄位 + JSONB → 統一 PostgreSQL WHERE",
"pfbIntroC1t": "① 建構", "pfbIntroC1d": "同一棵樹混「純欄位」與「JSONB 路徑」條件。",
"pfbIntroC2t": "② 編譯", "pfbIntroC2d": "@rfjs/pg-filter(sql-filter + jsonb-query)產出單一 WHERE。",
"pfbIntroC3t": "③ 即時", "pfbIntroC3d": "統一的 SQL 即時更新。"
```

- [ ] **Step 5: 驗證 + Commit**

```bash
pnpm -F web exec vitest run src/tools/data-filter-builder src/tools/sql-filter-builder src/tools/jsonb-query-builder src/tools/pg-filter-builder
pnpm -F web check-types && pnpm -F web lint
git add apps/web/src/tools/data-filter-builder apps/web/src/tools/sql-filter-builder apps/web/src/tools/jsonb-query-builder apps/web/src/tools/pg-filter-builder
git commit -m "feat(web): wire ToolIntro into the SQL/JSONB filter builders

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```
Expected:4 工具測試(含新接線斷言)PASS;types/lint 綠。

---

### Task 3: mongo-query-builder / es-query-builder / es-client-demo / decision-table

同 Task 2 的配方與流程。文案:

**mongo-query-builder(前綴 `mqbIntro`):** en `Tagline`="Build a filter tree → MongoDB query object";C1 "① Build"/"Nest and/or/not groups with field conditions.";C2 "② Compile"/"@rfjs/mongo-query emits the query object.";C3 "③ Live"/"The compiled query updates live." — zh `Tagline`="建一棵篩選樹 → MongoDB 查詢物件";C1 "① 建構"/"巢狀 and/or/not + 欄位條件。";C2 "② 編譯"/"@rfjs/mongo-query 產出查詢物件。";C3 "③ 即時"/"編出的查詢即時更新。"

**es-query-builder(前綴 `eqbIntro`):** en `Tagline`="Build a filter tree → Elasticsearch / OpenSearch bool query";C1 "① Build"/"Nest and/or/not groups with field conditions.";C2 "② Compile"/"@rfjs/es-query emits a bool query valid for both.";C3 "③ Live"/"The compiled query updates live." — zh `Tagline`="建一棵篩選樹 → Elasticsearch / OpenSearch bool 查詢";C1 "① 建構"/"巢狀 and/or/not + 欄位條件。";C2 "② 編譯"/"@rfjs/es-query 產出 ES 與 OpenSearch 通用的 bool 查詢。";C3 "③ 即時"/"編出的查詢即時更新。"

**es-client-demo(前綴 `ecdIntro`):** en `Tagline`="Filter → ES search body → run it (mock transport)";C1 "① Build"/"A filter, compiled to an Elasticsearch / OpenSearch search body.";C2 "② Run"/"@rfjs/es-client runs it over a mock transport that truly filters the sample data.";C3 "③ Inspect"/"search · paginate · highlight." — zh `Tagline`="篩選 → ES 搜尋 body → 實跑(mock transport)";C1 "① 建構"/"建篩選 → 編成 ES/OpenSearch 搜尋 body。";C2 "② 執行"/"@rfjs/es-client 用 mock transport 真的對範例資料執行。";C3 "③ 檢視"/"搜尋 · 分頁 · 高亮。"

**decision-table(前綴 `dctIntro`):** en `Tagline`="DMN-style rules (filter trees) → evaluate live";C1 "① Author"/"Rows are rules whose conditions are nested filter trees; outputs are constants or expressions.";C2 "② Evaluate"/"Run one context or a whole batch.";C3 "③ Live"/"Matched rule + output, live." — zh `Tagline`="DMN 式規則(篩選樹)→ 即時求值";C1 "① 編寫"/"每列是規則,條件是巢狀篩選樹,輸出是常數或運算式。";C2 "② 求值"/"對單一 context 或整批求值。";C3 "③ 即時"/"看命中規則與輸出。"

> **decision-table 例外(唯一有 eyebrow 的工具,不套用 wrap 配方)**:它的既有根已是 `<div className="flex flex-col gap-4">`,第一個 child 是 eyebrow `<p>{t("dtEyebrow")}</p>`(ui.tsx:176-179)。**不新增 wrapper** —— 直接把 `<ToolIntro storageKey="tool-intro:decision-table" …>` 插在該 eyebrow `<p>` **之後**(對齊 table-builder/metadata-builder 的「eyebrow 後」擺法,見 spec §分工)。其餘 3 個工具(mongo-query-builder / es-query-builder / es-client-demo)照 wrap 配方。es-client-demo 的 ui.spec 另需依「ui.spec 配方 (b)」把 provider 遷到 `assembleMessages("en")`。

- [ ] **Step 1–4:** 逐工具加 key(en+zh)+ 套 ui.tsx / ui.spec 配方(decision-table 依上方例外、es-client-demo 依配方 (b))。
- [ ] **Step 5:** 驗證 4 工具測試 + types + lint,commit:
```bash
git commit -m "feat(web): wire ToolIntro into mongo/es builders and decision-table

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: jsonb-query-generator / mongo-query-generator / data-filter-tester / jwt-decoder

同配方。文案(這組多為 2 concept):

**jsonb-query-generator(前綴 `jqgIntro`):** en `Tagline`="Filter metadata → PostgreSQL JSONB query";C1 "① Describe"/"Supply filter metadata (fields, operators, values).";C2 "② Generate"/"@rfjs/jsonb-query compiles it to a JSONB WHERE / ORDER BY." — zh `Tagline`="篩選 metadata → PostgreSQL JSONB 查詢";C1 "① 描述"/"給篩選 metadata(欄位、運算子、值)。";C2 "② 產生"/"@rfjs/jsonb-query 編成 JSONB WHERE / ORDER BY。"(此工具只 2 concept,ui.tsx concepts 陣列只放 C1/C2)

**mongo-query-generator(前綴 `mqgIntro`):** en `Tagline`="Filter metadata → MongoDB query";C1 "① Describe"/"Supply filter metadata (fields, operators, values).";C2 "② Generate"/"@rfjs/mongo-query compiles it to a query object." — zh `Tagline`="篩選 metadata → MongoDB 查詢";C1 "① 描述"/"給篩選 metadata(欄位、運算子、值)。";C2 "② 產生"/"@rfjs/mongo-query 編成查詢物件。"(2 concept)

**data-filter-tester(前綴 `dftIntro`):** en `Tagline`="Test @rfjs/data-filter conditions against sample data";C1 "① Write"/"A data-filter condition (JSONPath-style).";C2 "② Run"/"It evaluates against the sample data live.";C3 "③ Live"/"Matched results update as you type." — zh `Tagline`="拿 @rfjs/data-filter 條件對範例資料試跑";C1 "① 撰寫"/"一條 data-filter 條件(JSONPath 風格)。";C2 "② 試跑"/"對範例資料即時求值。";C3 "③ 即時"/"邊打邊看符合結果。"

**jwt-decoder(前綴 `jwtIntro`):** en `Tagline`="Paste a JWT → header + payload + live expiry";C1 "① Paste"/"A JWT string.";C2 "② Decode"/"@rfjs/jwt splits and decodes the header + payload (no verification).";C3 "③ Expiry"/"A live expiry chip ticks against exp." — zh `Tagline`="貼一個 JWT → header + payload + 即時有效期";C1 "① 貼上"/"JWT 字串。";C2 "② 解碼"/"@rfjs/jwt 拆解並解碼 header + payload(不驗簽)。";C3 "③ 有效期"/"徽章依 exp 即時跳動。"

- [ ] **Step 1–5:** 同前;2-concept 工具的 ui.tsx concepts 陣列只放兩個。commit:
```bash
git commit -m "feat(web): wire ToolIntro into the query generators, filter tester, jwt decoder

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: object-flatten / type-converter / form-builder

同配方。文案:

**object-flatten(前綴 `oflIntro`):** en `Tagline`="Nested object ⇄ dot-path keys";C1 "① Flatten"/"@rfjs/object-utils turns nested objects into a.b.c keys.";C2 "② Unflatten"/"And back again, round-trip." — zh `Tagline`="巢狀物件 ⇄ 點路徑鍵";C1 "① 壓平"/"@rfjs/object-utils 把巢狀物件變成 a.b.c 鍵。";C2 "② 還原"/"也能反向還原,來回往返。"(2 concept)

**type-converter(前綴 `tcvIntro`):** en `Tagline`="Convert a value between string / number / boolean / date";C1 "① Pick"/"A source value and a target type.";C2 "② Convert"/"@rfjs/data-transform coerces it, showing the result live." — zh `Tagline`="在 string / number / boolean / date 間轉換值";C1 "① 選擇"/"來源值與目標型別。";C2 "② 轉換"/"@rfjs/data-transform 轉換並即時顯示結果。"(2 concept)

**form-builder(前綴 `fblIntro`):** en `Tagline`="Drag fields on a 12-column grid → live form preview";C1 "① Lay out"/"Drag fields/content onto a 12-column grid, group them.";C2 "② Configure"/"Set per-field type, validation, rules, data source.";C3 "③ Preview"/"The live form (and its result) renders as you build." — zh `Tagline`="在 12 欄格線拖欄位 → 即時表單預覽";C1 "① 佈局"/"把欄位/內容拖上 12 欄格線、分組。";C2 "② 設定"/"逐欄設型別、驗證、規則、資料來源。";C3 "③ 預覽"/"即時預覽表單與其結果。"

- [ ] **Step 1–5:** 同前;commit:
```bash
git commit -m "feat(web): wire ToolIntro into object-flatten, type-converter, form-builder

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: changeset + 全面驗證 + 截圖(controller 可直跑)

- [ ] **Step 1: changeset**

`.changeset/web-toolintro-rollout.md`:
```md
---
"web": patch
---

Roll the collapsible ToolIntro explainer out to the remaining 15 web tools, and consolidate its control strings into shared central ToolUI keys (introQuestion/introExpand/introCollapse/introDismiss).
```

- [ ] **Step 2: 全面驗證**

Run: `pnpm -F web test 2>&1 | grep -E "Test Files|Tests " && pnpm -F web check-types && pnpm -F web lint`
Expected:全綠(每工具接線斷言 + 遷移的 2 工具皆綠)。

- [ ] **Step 3: 每工具 fragment en↔zh 對稱檢查**

Run: 對 15 工具 messages.ts 各自比對 en 與 zh-TW 的 `ToolUI` key 集合相等(可用該 repo 既有的 messages-parity 測試模式;或手動 grep 每工具 `<前綴>` key 兩 locale 數量一致)。Expected:每工具兩 locale key 數相等。

- [ ] **Step 4: dev server + 截圖**

```bash
lsof -ti :3173 | xargs -r kill
pnpm --dir apps/web exec next dev --port 3173 &
```
用 bundled chromium(`/home/royfw/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome`,CJS import)截:一個 ToolShell 系工具(如 object-flatten)收合+展開、一個 custom 系(如 sql-filter-builder)收合+展開、form-builder 展開、dark/light 各一。截完 kill server。

- [ ] **Step 5: commit + 分支總結**

```bash
git add .changeset/web-toolintro-rollout.md
git commit -m "chore: changeset for ToolIntro suite-wide rollout

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
git log --oneline main..HEAD && git status
```
Expected:6 個 code/chore commits + 乾淨 working tree。**HOLD —— 不開 PR**。

---

## Self-Review(已跑)

- **Spec coverage**:控制 key 集中(T1)、15 工具接線 + 文案(T2–T5)、遷移既有 2 工具(T1)、測試每工具接線(配方)、changeset(T6)、截圖(T6)。✓
- **Placeholder scan**:15 工具文案皆具體;ui.tsx/ui.spec 配方各出現一次並被每工具引用(非「similar to」占位)。✓
- **Type/collision consistency**:每工具唯一前綴(權威表),避開扁平 ToolUI namespace 互蓋;控制 key 只中央定義一次;storageKey 每工具唯一。✓
- **已知**:concept term 的 ①②③ 與既有 table-builder 一致;2-concept 工具明確標注只放兩個。
