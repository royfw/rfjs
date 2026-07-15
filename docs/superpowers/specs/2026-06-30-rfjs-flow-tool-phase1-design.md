# flow-builder tool(apps/web)Phase 1 — 可編輯畫布(無 runtime)設計

- 日期:2026-06-30
- 狀態:設計已核可,待寫實作計畫(writing-plans)
- 上層方向:`docs/superpowers/specs/2026-06-30-rfjs-flow-design.md`(north star,PR #225);本文是其 **v1 的 Phase 1** 聚焦 spec。
- 分支 / worktree:`feat-flow-tool`(`.claude/worktrees/feat-flow-tool`,由 `origin/main` 建立)

## 1. 目標

在 `apps/web` 新增一個 tool `flow-builder`(`/tools/flow-builder`),讓使用者用 **React Flow 視覺畫布**建立流程:拖出節點、連線、選節點在 inspector 內**編輯既有工具的設定**(form 節點編 FormConfig、condition 節點編 filter tree),並**即時看到產出的自有 flow JSON**。

**Phase 的定位(使用者決策「先 1 後 3」):**
- **Phase 1(本文)**:可編輯畫布 + **鎖定 flow JSON schema**(且**預留** runtime 要用的欄位),產出 JSON,**但不執行**。
- **Phase 2(之後)**:navigation runtime(wizard 真的跑)當成「JSON 的另一個消費者」加上去,**不需回頭改編輯器**。flow JSON schema 是兩者的接縫(同 filter-builder 的 edit↔execute)。

## 2. 非目標(Phase 1 明確不做)

- **不做 runtime / 執行**(不跑 wizard、不評估條件、不執行 action)。
- 不做持久化 / 後端儲存(state 留前端;JSON 可複製/貼上匯入即可)。
- **不抽 `@rfjs/flow` 套件** —— 先 app-local,穩了再抽。
- 不做 `data-op`(join/select)、不做 AI 節點、不做 durable/簽核。
- 不做迴圈 / 平行(分支足矣)。
- 不做 LR auto-layout 的「整理」按鈕(north star 提到,Phase 1 可省;節點手動擺即可)。

## 3. 架構

App-local tool,檔案集中在 `apps/web/src/tools/flow-builder/`。schema/types 先放 tool 內。

```
apps/web/src/tools/flow-builder/
  index.ts          ToolModule { id:'flow-builder', Component: FlowBuilderTool }
  ui.tsx            "use client" — FlowBuilderTool:ReactFlow 畫布 + palette + inspector + JSON 面板
  messages.ts       i18n(en + zh-TW;ToolUI 以 flow* 前綴)
  schema.ts         zod flow JSON schema + 型別 + 預設空流程
  model.ts          純函式:flow model ↔ React Flow(nodes/edges)對映、加節點/連線/更新 config/轉 JSON
  nodes/            自訂節點元件(精簡預覽):start、end、form、condition、action
    *.tsx
  inspector/        每種節點的編輯面板(內嵌既有編輯器)
    form-inspector.tsx       → 內嵌 ConfigFormBuilder
    condition-inspector.tsx  → 內嵌 FilterTreeEditor
    action-inspector.tsx     → kind + params 小表單
  sample.ts         一個內建範例流程(請假申請)
  *.spec.ts(x)      co-located
```

## 4. flow JSON schema(`schema.ts`,zod,鎖定 + 預留)

```ts
// 節點型別(Phase 1 實作這幾種;ai / human-task / data-op 之後再加)
type FlowNodeType = 'start' | 'end' | 'form' | 'condition' | 'action';

interface FlowNode {
  id: string;
  type: FlowNodeType;
  position: { x: number; y: number };
  // 內嵌既有工具 JSON,不發明新格式:
  //   form      → FormConfig(@rfjs/form-builder)
  //   condition → filter tree(@rfjs/filter-builder 的 BuilderGroup)
  //   action    → { kind: string; params: Record<string, unknown> }
  //   start/end → 無 config
  config?: unknown;          // 以 discriminated union 依 type 收斂
  // 預留(Phase 2 才用到;Phase 1 存但不執行):
  inputs?: string[];         // 多輸入:此節點吃哪些上游節點輸出(join ≥2)
  outputCollection?: boolean;// 輸出是否為集合/多筆
}

interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;     // condition 的 'yes'/'no'
  label?: string;
  // 預留(Phase 2 navigation runtime 才用到):
  trigger?: 'onSubmit' | 'onClick' | string;
  condition?: unknown;       // 邊上的條件(可選;或由 condition 節點負責)
}

interface FlowDoc {
  version: 1;
  nodes: FlowNode[];
  edges: FlowEdge[];
}
```

- `parseFlow(json) → FlowDoc`(zod,throws on invalid);`flowToJson(doc) → string`(formatted)。
- **`node.config` 直接是既有工具的 JSON**(FormConfig / filter tree),不轉換、不包裝。

## 5. 元件與行為

### 5.1 畫布(`ui.tsx`,React Flow)
- 用 `@xyflow/react`(MIT)的 `<ReactFlow>`,自訂 `nodeTypes`(start/end/form/condition/action)。
- 匯入 React Flow CSS(`@xyflow/react/dist/style.css`)。
- 節點上只顯示**精簡預覽**(類型圖示 + 名稱 + 幾個欄位/條件 chip),**不在節點內塞完整編輯器**。
- condition 節點有兩個 source handle:`yes` / `no`。
- 連線、拖動、平移縮放由 React Flow 提供;`onNodesChange`/`onEdgesChange`/`onConnect` 經 `model.ts` 寫回 flow model。

### 5.2 Palette
- 左側清單:form / condition / action / end(start 預設已有一顆)。點擊或拖曳 → 在畫布加一個對應節點(預設位置 + 空 config)。

### 5.3 Inspector(右側,選到節點才出現)
依 `node.type` 渲染對應編輯器,**只渲染目前選取節點的編輯器**(避免一次掛多個重元件):
- **form** → `<ConfigFormBuilder initialConfig={node.config as FormConfig} onChange={cfg => updateNodeConfig(id, cfg)} locale={...} locales={['en','zh-TW']} />`(`@rfjs/form-builder-ui`)。
- **condition** → `<FilterTreeEditor ... />`(`@rfjs/filter-builder-ui`)。**欄位來源**:Phase 1 用一組「宣告的 / 範例欄位」(因為真正可用欄位要等 runtime 才知道上游輸出);這是 Phase 1 的合理簡化,Phase 2 再由 context 推導。
- **action** → 小表單:`kind`(下拉:`notify` / `db.update` / `http` …示意用)+ `params`(key-value)。
- start/end → 只顯示名稱。

### 5.4 JSON 面板
- 一個分頁 / 底部面板,**即時**顯示 `flowToJson(doc)`(唯讀,等寬字)。
- 可選「貼上 JSON → `parseFlow` 匯入」(無效顯示錯誤);Phase 1 至少要有唯讀顯示。

## 6. 註冊 / 接線(同 bpmn 那套)
- `packages/web-core/src/registry/tools.ts` append:`{ id:'flow-builder', category:'generator', surface:'web', status:'preview', relatedPackages:['@rfjs/form-builder','@rfjs/filter-builder'], tags:['flow','builder','canvas','no-code'] }`(兩個 relatedPackages 都已在 packageRegistry,滿足 registry.spec;**不需**新增 package 條目)。
- apps/web 聚合器 `tools/index.ts` + `tools/messages.ts` append;`tools/index.spec.ts` 的 `EXPECTED_WEB_TOOL_IDS` 加 `'flow-builder'`。
- `apps/web/package.json`:加 `@xyflow/react`(一般 npm dep,**不需** transpilePackages;但 `@rfjs/form-builder-ui` / `@rfjs/filter-builder-ui` 已在 transpilePackages)。
- i18n:`Tools['flow-builder'].{title,description}` + `ToolUI` 的 `flow*` 前綴鍵(en + zh-TW);`Packages.<slug>` 不需動(無新套件)。

## 7. 測試策略
- **純函式單元**:`schema.ts`(parseFlow 接受/拒絕、flowToJson 往返)、`model.ts`(加節點、連線、更新 config、flow↔ReactFlow 對映、condition 的 yes/no handle)。
- **UI 單元(jsdom)**:**mock `@xyflow/react`**(jsdom 無法量測佈局),驗證:palette 加節點 → model 變化;選節點 → inspector 出對的編輯器(form→ConfigFormBuilder、condition→FilterTreeEditor、action→kind 表單,可用 mock/spy 確認掛載);JSON 面板反映 model。需 next-intl provider(比照其他 tool 的 ui.spec)+ jsdom shims(pointer capture / ResizeObserver,比照 form-builder spec)。
- **Playwright e2e**:真畫布渲染 —— 載入範例流程,斷言 React Flow 節點出現(`.react-flow__node`);從 palette 加一個節點 → 節點數 +1;連一條線 → `.react-flow__edge` 出現;JSON 面板含該節點 id。(React Flow 真互動靠瀏覽器,比照 bpmn e2e 基礎設施。)

## 8. 風險 / 已知
- **React Flow 在 jsdom 不可量測** → 真互動只能 e2e;單元 mock。
- **inspector 內嵌重編輯器** → 只渲染選取節點的編輯器,避免效能/狀態爆炸。
- **condition 欄位來源** → Phase 1 用宣告/範例欄位(真正可用欄位是 Phase 2 的 context 課題)。
- **FilterTreeEditor / ConfigFormBuilder 的 props 介面** → 實作時以實際型別為準(`ConfigFormBuilderProps`、`FilterTreeLabels`);labels-as-props 需給 i18n 文案。
- **schema 鎖定責任重** → 預留欄位(inputs/outputCollection/edge.trigger/condition)現在就放進 zod,Phase 2 不用改格式。

## 9. 慣例
spec/plan 繁中;commit/PR 英文 conventional(結尾 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`);worktree 內開發;**HOLD PR** 由人工合併;私有 / app-local 變更 **無 changeset**。
