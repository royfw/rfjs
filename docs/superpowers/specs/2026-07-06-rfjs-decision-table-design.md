# @rfjs/decision-table — 決策表(引擎 + 展示 tool)設計

- 日期:2026-07-06
- 狀態:設計已核可,待寫實作計畫(writing-plans)
- 分支 / worktree:`feat-decision-table`(`.claude/worktrees/feat-decision-table`,由 `origin/main` ad849f2 建立)
- 背景:DMN「決策表」概念的 rfjs 原生實作(**不採 DMN XML/FEEL 標準**)。與 `@rfjs/flow` 路線圖銜接:未來直接成為 flow 的 `decision-table` node kind,服務簽核路由(對應 memory `rfjs-flow-canvas-direction` 的 OMG-standards mapping)。

## 1. 目標

用**三顆既有套件的組合**做出決策表能力:

> 一張表 = 有序的規則列;每列 = 「條件(filter-builder 條件樹)→ 輸出(常值或 data-expr 表達式)」;給一筆 context,依 hit policy 得到輸出。

- **執行層**:新套件 `@rfjs/decision-table`(可發佈,與 filter-builder 家族同輩)—— schema + `evaluateTable` 純邏輯。
- **展示層**:apps/web tool `decision-table`(`/tools/decision-table`)—— 表格編輯 + 單筆/批次試算 + JSON 匯入匯出。
- 範例場景:**簽核路由**(金額/部門 → 簽核人)。

### 已鎖定決策

| 決策 | 結論 |
| --- | --- |
| 套件定位 | **可發佈套件** `packages/decision-table`(比照 `filter-builder`:tsdown 出 dist、main/module/types 指 dist、可發 npm) |
| hit policy | **`first` + `collect`** 兩種(YAGNI;schema 留欄位,未來要加再擴充 enum) |
| 輸出形式 | **常值 + 可選表達式**:字串以 `"="` 前綴 → `data-expr`(JSONata)對 context 運算(沿用 data-filter 的 computed `=` 慣例) |
| demo 範圍 | 表格編輯 + 單筆試算 + **多筆批次試算** + JSON 面板(唯讀 + 貼上匯入) |
| AI | **v1 不含**(見〈未來擴充〉;AI assist 是獨立橫向專案,memory `rfjs-ai-assist-direction`) |

## 2. 架構(edit ↔ execute,repo 既有分層)

```
@rfjs/decision-table(packages/decision-table,執行層,可發佈)
  types + zod schema + evaluateTable(純邏輯,無 UI)
  依賴:@rfjs/filter-builder(BuilderGroup 型別、runLiveMatch、FieldSchema)
        @rfjs/data-expr(compile/evaluate,"=" 表達式)
        zod
        ▲ workspace dep
apps/web/src/tools/decision-table/(展示層)
  表格編輯 UI(條件內嵌 @rfjs/filter-builder-ui 的 FilterTreeEditor)
  + 單筆/批次試算 + JSON 面板
```

## 3. 資料模型(套件 `types.ts` + `schema.ts`)

```ts
type HitPolicy = "first" | "collect";

interface DecisionOutputDef {
  key: string;          // 輸出欄 key(在 outputs record 中的鍵)
  label?: string;
}

interface DecisionRule {
  id: string;
  description?: string;
  /** filter-builder 條件樹「原樣內嵌」(零轉換;任意巢狀 and/or/nor/not + elemmatch)。 */
  when: BuilderGroup;
  /** 輸出值:常值直接用;字串以 "=" 前綴 → data-expr 對 context 運算。 */
  outputs: Record<string, unknown>;
}

interface DecisionTable {
  version: 1;
  name?: string;
  /** 欄位定義(給編輯器的 FieldCombobox 用;沿用 filter-builder 的 FieldSchema)。 */
  inputs?: FieldSchema[];
  outputs: DecisionOutputDef[];
  hitPolicy: HitPolicy;
  /** 有序:由上而下評估。 */
  rules: DecisionRule[];
  /** 無命中時的 else 輸出(可選;值同樣支援 "=" 表達式)。 */
  defaultOutputs?: Record<string, unknown>;
}
```

- zod schema:`decisionTableSchema`;`when` 以 filter-builder 的樹形狀驗證(結構性;深度驗證交給編輯器/引擎)。
- `parseTable(json: string): DecisionTable`(zod,invalid 即 throw)、`tableToJson(t): string`。
- 編輯輔助(給 UI 用的小純函式):`emptyTable()`、`newRule(id)`、`moveRule(t, from, to)`。

## 4. 執行(`evaluate.ts`)

```ts
interface RuleError { ruleId: string; kind: "uncoverable" | "expression"; message: string }

interface EvaluateResult {
  hitPolicy: HitPolicy;
  /** 命中的 ruleId(依表內順序;first 至多 1 個)。 */
  matched: string[];
  /** first → 單一 record 或 null;collect → record[](可為空)。 */
  outputs: Record<string, unknown> | Record<string, unknown>[] | null;
  /** 無命中而套用 defaultOutputs 時為 true。 */
  usedDefault: boolean;
  /** 無法評估的列(見下);呼叫端/UI 必須呈現,不得靜默。 */
  ruleErrors: RuleError[];
}

async function evaluateTable(
  table: DecisionTable,
  context: unknown,
  opts?: { strict?: boolean },
): Promise<EvaluateResult>;
```

行為:

1. 邊界驗證:`table` 先過 zod(invalid 即 throw)。
2. 逐列判斷命中:`runLiveMatch([context], rule.when)`;`count === 1` 即命中。
3. **`uncoverable` 處理(重要)**:`runLiveMatch` 回 `uncoverable: true` 表示該列條件用了 data-filter 無法在記憶體評估的運算子 —— **不得靜默當作「不命中」**(決策表用於路由,錯默比錯吵危險)。行為:該列跳過命中計算、記入 `ruleErrors[{kind:"uncoverable"}]`;`opts.strict: true` 時直接 throw 具名錯誤。
4. 輸出解析:命中列(或 defaultOutputs)的每個值 —— 字串以 `"="` 前綴者,`stripExpressionPrefix` 後交給 `data-expr` 對 context 評估(async);運算失敗記入 `ruleErrors[{kind:"expression"}]`(strict 時 throw),該輸出鍵給 `undefined`。其餘值原樣。
5. hit policy:`first` 取第一個命中列;`collect` 收集全部命中列的輸出(依序)。
6. 無命中:有 `defaultOutputs` → 解析之、`usedDefault: true`;否則 `outputs: null`。
7. `evaluateTable` 為 **async**(data-expr/JSONata 本質 async);純常值表也走同一介面(一致性優先)。

## 5. 巢狀支援(設計重點,回應核心提問)

| 層次 | 支援 | 憑什麼 |
| --- | --- | --- |
| **條件巢狀** | ✅ v1 | `when` 是完整 `BuilderGroup` —— 任意 and/or/nor/not 巢狀 + elemmatch,編輯(FilterTreeEditor)與評估(runLiveMatch)皆現成。**這是相對傳統 DMN 扁平條件欄的核心優勢** |
| **資料巢狀** | ✅ v1 | 條件路徑走巢狀 context(`applicant.dept`)、陣列用 elemmatch;`=` 表達式是 JSONata,天生遍歷巢狀 |
| **表巢狀**(表呼叫表 / DMN DRD) | ❌ 非目標 | 決策鏈是「編排」職責 —— 未來在 flow 放兩個 decision-table 節點以 context 串接;schema 不堵路(要表內引用時加一種 output 形式即可) |

## 6. 展示 tool(`apps/web/src/tools/decision-table/`)

```
index.ts        ToolModule { id: "decision-table", Component: DecisionTableTool }
ui.tsx          "use client" — 表格 + 試算 + JSON
messages.ts     i18n(en + zh-TW;ToolUI 鍵以 dt* 前綴)
sample.ts       範例:簽核路由表(含一列 "=" 表達式示範)+ 範例批次 rows
rule-sheet.tsx  列編輯滑出面板(沿用 flow-builder node-sheet 模式:寬 sheet + Esc/X/backdrop)
*.spec.ts(x)    co-located
```

UI 行為:

- **表格編輯**:每列顯示 描述 + 條件摘要 chip + 各輸出欄的值;點列 → 寬 sheet 開啟:內嵌 `FilterTreeEditor` 編條件(labels-as-props,同 flow-builder 的 filterLabels 做法;欄位來源 = `table.inputs`)+ 輸出值編輯(文字框,`=` 開頭即表達式)+ 描述。列的新增/刪除/上下移;hitPolicy 切換(Select);inputs/outputs 欄定義可增刪(簡單表單)。
- **單筆試算**:context JSON textarea → `evaluateTable` 即時執行 → 命中列高亮 + 輸出結果 + `usedDefault`/`ruleErrors` 呈現(錯誤列標紅,不靜默)。
- **批次試算**:貼 JSON array → 每筆跑 `evaluateTable` → 結果表(每筆:輸入摘要 → 命中列 → 輸出)。
- **JSON 面板**:`tableToJson` 唯讀顯示 + 貼上經 `parseTable` 匯入(invalid 顯示錯誤)。
- 佈局採簡單直落式(編輯表格 → 試算 → JSON),不需要畫布。

## 7. 註冊接線(append;與並行 session 的紅線一致 —— 這些檔由**本任務**動)

- `packages/web-core/src/registry/tools.ts` append:
  `{ id: 'decision-table', category: 'transform', surface: 'web', status: 'preview', relatedPackages: ['@rfjs/decision-table', '@rfjs/filter-builder'], tags: ['decision', 'rules', 'routing', 'dmn'] }`
- `packages/web-core/src/registry/packages.ts` append `@rfjs/decision-table`(status `preview`、href `/packages/decision-table`、github、relatedTools `['decision-table']`;**暫無 npm 欄位**,發佈後再補)。
- `apps/web/src/messages/{en,zh-TW}.json` 加 `Packages.decision-table.description`(i18n-content spec 會強制)。
- apps/web 聚合器 `tools/{index,messages}.ts` append;`tools/index.spec.ts` 的 `EXPECTED_WEB_TOOL_IDS` 加 `"decision-table"`。
- `apps/web/package.json` 加 `"@rfjs/decision-table": "workspace:*"`。
- **不動** `next.config.js` transpilePackages(套件有 dist build)。⚠️ 開發迭代時改套件要重跑 `pnpm -F @rfjs/decision-table build`(同 filter-builder 慣例;memory `rfjs-filter-builder-dist-rebuild` 的老坑)。
- 發佈準備:附 changeset(`@rfjs/decision-table` minor)讓下一班 release 車發 0.1.0;若屆時不想發,再把它加進 ignore。

## 8. 測試策略

- **套件單元**(vitest,node/jsdom 皆可):
  - schema:合法/非法表(缺 outputs、壞 hitPolicy、rules 非陣列…)、`parseTable`/`tableToJson` 往返。
  - evaluate:first 命中第一列(含後列也命中時不取)、collect 收集多列且依序、無命中 + defaultOutputs / 無 default、`=` 表達式成功(含巢狀 context 與運算)、表達式失敗 → ruleErrors + strict throw、**uncoverable 條件 → ruleErrors + strict throw**、空 rules、空 context、條件巢狀(and/or/not 組合)與 elemmatch 各一例。
  - 編輯輔助:emptyTable/newRule/moveRule。
- **tool 單元**(jsdom):mock `FilterTreeEditor`(重元件);範例表渲染、單筆試算流(輸入 → 命中高亮 + 輸出,用真 `@rfjs/decision-table`)、批次試算行數、JSON 匯入(合法/非法)。
- **e2e**(既有 Playwright 基礎設施):`/en/tools/decision-table` 渲染範例表 → 貼 context → 看到輸出值;沿用 `next build`+`next start` 驗證(不要用 `next dev`,會踩 inotify 上限)。

## 9. 非目標(YAGNI)

- 不採 DMN XML / FEEL / DRD 標準。
- 不做 `unique`/`any`/`priority`/`rule-order` 等其他 hit policy(schema enum 可後續擴充)。
- 不做表巢狀(表呼叫表)—— 交給 flow 編排。
- 不做持久化 / 後端。
- **不做 flow node kind 整合**(本套件 API 已為它準備好:`evaluateTable(table, context)` 就是節點的執行函式)。
- 不含 AI 功能。

## 10. 未來擴充(不實作,僅確保不堵路)

- **flow 整合**:`decision-table` node kind —— `node.config` 內嵌 DecisionTable JSON,runtime 呼叫 `evaluateTable(config, context)`,輸出寫回 context。
- **AI 輔助**(獨立橫向專案,memory `rfjs-ai-assist-direction`):自然語言 → 規則列、表格檢查(缺口/重疊/不可達列)、白話總結 —— 走注入 seam,套件本身維持 AI-free。
- 更多 hit policy、表內引用(表巢狀)。

## 11. 風險 / 已知

- **async evaluate**:UI 試算為 async 流(debounce + 竸態丟棄舊結果,比照 bpmn viewer 的 import 競態原則)。
- **uncoverable 運算子**:編輯器允許選到 data-filter 不支援的運算子(如 SQL-only op)→ 已定義行為(§4.3);UI 需標示該列不可在記憶體試算。
- **dist 重建坑**:改套件不重建 → app 看不到變化(memory 已有記載,plan 會提醒)。
- **表達式安全**:data-expr 本身即「safe JSONata wrapper」(受控環境),不引入 eval。

## 12. 慣例

spec/plan 繁中;commit/PR 英文 conventional(subject 全小寫開頭,結尾 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`);worktree 內開發;**HOLD PR**;新套件附 changeset(見 §7)。
