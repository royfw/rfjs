# flow-builder BPMN 檢視 / 匯出 — 設計規格

日期:2026-07-06
分支:`feat-flow-bpmn-view`(獨立 worktree,基於 `origin/main` @ `ad849f2`)
狀態:已與使用者確認(UI 形式 = 分頁切換;投影預設 = 完整圖;偏離①② 已裁決採納)

## 目標

flow-builder(`apps/web/src/tools/flow-builder/`,/tools/flow-builder)新增「以 BPMN 檢視 / 匯出」能力,並順手收掉兩個殘留 minors:

1. **`projectFlow(doc, { keep })`** 純函式:節點型別過濾投影,被移除節點的邊自動「縮線」接起 —— 產生給人看的簡化圖。
2. **`compileToBpmn(doc)`** 純函式:FlowDoc → BPMN 2.0 XML(單向編譯)。
3. **UI「BPMN」分頁**:內嵌 `@rfjs/bpmn-ui` 的 `<BpmnViewer>` 顯示編譯結果 + 「只看人工節點」投影切換 + 下載 `.bpmn`。
4. **Minors**:`nodes.tsx` 節點型別標籤 i18n 化;`model.ts` 的 module-level `nodeSeq` 改純函式推導。

## 非目標(明確不做)

- **不做反向**:不解析 BPMN 回 FlowDoc;FlowDoc 是唯一真相來源,BPMN 只是顯示/匯出皮膚。
- **不儲存 BPMN**:XML 每次由當前 FlowDoc 即時編譯(`useMemo`),不落地、不進 FlowDoc schema。
- **不改 FlowDoc schema**(`schema.ts` 不動)。
- **不動共用檔案**(並行紅線):`packages/web-core/src/registry/{tools,packages}.ts`、`apps/web/src/tools/{index,messages}.ts`、`apps/web/src/tools/index.spec.ts`、`apps/web/next.config.js`、`apps/web/package.json` 一律不碰。本任務不是新 tool,所有變更限於 `apps/web/src/tools/flow-builder/**` + `apps/web/e2e/**`(新增 spec 檔)。

## 檔案結構

全部位於 `apps/web/src/tools/flow-builder/`:

| 檔案 | 動作 | 內容 |
|---|---|---|
| `projection.ts` + `projection.spec.ts` | 新增 | `projectFlow` 純函式 |
| `bpmn.ts` + `bpmn.spec.ts` | 新增 | `compileToBpmn` 純函式 |
| `bpmn-view.tsx` + `bpmn-view.spec.tsx` | 新增 | BPMN 分頁面板元件 |
| `ui.tsx` + `ui.spec.tsx` | 修改 | 「編輯 / BPMN」分頁切換 |
| `messages.ts` | 修改 | 新增 `flow*` i18n 鍵(en + zh-TW) |
| `nodes.tsx` + `nodes.spec.tsx` | 修改 | 標籤 i18n(minor) |
| `model.ts` + `model.spec.ts` | 修改 | `nodeSeq` → `nextNodeId` 純函式(minor) |

另新增一條 e2e:`apps/web/e2e/flow-bpmn.spec.ts`(檔名依現有 e2e 目錄慣例調整)。

## 1. `projectFlow(doc, options): FlowDoc`

```ts
interface ProjectOptions {
  /** 要保留的「中間節點」型別;start/end 永遠保留,不受此參數影響。 */
  keep: FlowNodeType[];
}
export function projectFlow(doc: FlowDoc, options: ProjectOptions): FlowDoc;
```

規則:

- **保留集合** = `{'start','end'} ∪ keep`。不在集合內的節點移除。
- **縮線(edge contraction)**:對每個被移除節點 n,其每條入邊 × 每條出邊組合成新邊(source = 入邊.source、target = 出邊.target)。以迭代收斂(或等價的圖走訪)處理**連續多個被移除節點**構成的鏈。
- **新邊屬性**:
  - `id`:`proj-<source>-<target>`;若同一對 (source, target) 因不同 label 產生多條,附加 label 區別(如 `proj-cond-1-end-yes`),確保 id 唯一。
  - `label`:沿用縮線鏈上**第一條邊**(最靠 source 端)的 label;無則留空。這讓 condition 的 yes/no 在 action 被濾掉後仍可讀。
  - `sourceHandle`:沿用鏈上第一條邊的 sourceHandle(保持 FlowDoc 形狀合法,若未來要渲染投影結果)。
  - `trigger`/`condition`:不沿用(語義屬於被移除的原始邊,拼接後不成立)。
- **去重**:以 `(source, target, label)` 三元組去重 —— label 不同的平行邊(yes/no 同指一個 target)必須各自保留。
- **丟自環**:縮線後 source === target 的邊丟棄。
- **未被縮線波及的原始邊**原樣保留(含所有欄位)。
- **節點座標不動**:保留節點維持原 position(移除處留空即可)。
- 純函式:不改動輸入 doc。

範例(內建請假範例,`keep: ['form','condition']`):

```
原圖:  start → form → cond ─yes→ [act-1] → end
                          └─no→ [act-2] → end
投影:  start → form → cond ─yes→ end
                          └─no→ end
```

## 2. `compileToBpmn(doc): string`

### 節點對映(已鎖)

| FlowDoc type | BPMN 元素 | DI 尺寸 | name |
|---|---|---|---|
| `start` | `bpmn:startEvent` | 36×36(中心對齊) | `Start` |
| `end` | `bpmn:endEvent` | 36×36(中心對齊) | `End` |
| `form` | `bpmn:userTask` | 150×62(bounds = position 原值) | `Form` |
| `condition` | `bpmn:exclusiveGateway` | 50×50(中心對齊) | `Condition` |
| `action` | `bpmn:serviceTask` | 150×62(bounds = position 原值) | `Action: <kind>`(config.kind,無則 `Action`) |

edge → `bpmn:sequenceFlow`,`name` = edge.label(如 yes/no;無 label 則不輸出 name 屬性)。

### DI 座標(採納偏離①:標準尺寸 + 中心對齊)

FlowDoc 節點在 React Flow 畫布上的佔位:寬 150,高 46(start/end/condition)或 62(form/action)。編譯時:

- 節點**中心** = `(position.x + 75, position.y + h/2)`(h 依型別 46 或 62)。
- event(36×36)、gateway(50×50)的 `dc:Bounds` 以該中心回推左上角;task(150×62)直接用 position(start/end/condition 高 46 vs form/action 高 62,task 已同高故 bounds 不變)。
- 效果:主線對齊(如範例 y=150)完全保留,且 bpmn-js 畫出正統小圓 / 菱形 / 圓角矩形,不會出現 150×46 bounds 被畫成溢出大圓的問題。

waypoints:每條 sequenceFlow 兩點直線 —— source 形狀**右緣中心** → target 形狀**左緣中心**(對應現有節點 handle 都在 Left/Right)。

### XML 形狀(比照 `apps/web/src/tools/bpmn-viewer/samples.ts` 的合法樣本)

- 根:`bpmn:definitions`,宣告 4 個 namespace(`bpmn`/`bpmndi`/`dc`/`di`)+ `id` + `targetNamespace="http://bpmn.io/schema/bpmn"`。
- `bpmn:process`(`isExecutable="false"`):每個節點元素內含其 `bpmn:incoming` / `bpmn:outgoing` 子元素(引用 sequenceFlow id);`bpmn:sequenceFlow` 帶 `sourceRef` / `targetRef`。
- `bpmndi:BPMNDiagram` → `bpmndi:BPMNPlane`(`bpmnElement` = process id):每個節點一個 `BPMNShape`(gateway 加 `isMarkerVisible="true"`)、每條邊一個 `BPMNEdge` 含 `di:waypoint`。
- **id 安全化**:BPMN id 須為 XML NCName(不得以數字開頭、不得含空白等)。FlowDoc id 一律轉為 `Node_<sanitized>` / `Flow_<sanitized>`(sanitize:非 `[A-Za-z0-9_.-]` 字元替換為 `_`);sanitize 後若撞名則附序號。process id `Process_1`、definitions id `Definitions_1`、diagram/plane/di id 依樣本慣例(`<id>_di` 等)。
- **XML escaping**:所有寫入屬性/文字的值(name、label)做 `& < > " '` 轉義。
- 產出以字串模板組裝即可(無第三方 XML 依賴),但轉義與 id 安全化必須集中成小函式並各自測試。
- **孤兒引用防護**:edge 的 source/target 若指到不存在的節點(理論上不會,防禦性),該邊跳過不輸出 —— 保證產出 XML 的 id 引用永遠完整、bpmn-js 可渲染。

## 3. UI — 「編輯 / BPMN」分頁

`ui.tsx` 結構調整(同一塊 560px 區域互換,頁面不變長):

```
eyebrow
[編輯] [BPMN]                       ← segmented tabs
── 編輯分頁 ──────────────────
  + 表單 + 條件 + 動作 + 結束      ← 新增按鈕只在編輯分頁顯示
  <ReactFlow 560px>
── BPMN 分頁 ─────────────────
  [只看人工節點 ⬡切換]  [下載 .bpmn]
  <BpmnViewer 560px>(唯讀)
──────────────────────────────
Flow JSON(兩個分頁都顯示;它是唯一真相 FlowDoc)
NodeSheet inspector(僅編輯分頁會有選取)
```

- 分頁元件:比照 apps/web 現有 tabs 模式(web-ui 的 segmented 樣式);切到 BPMN 分頁時清除節點選取(`setSelectedId(null)`)。
- **編譯時機**:`useMemo(() => compileToBpmn(projected ? projectFlow(doc, { keep: ['form','condition'] }) : doc), [doc, projected])` —— 只在 BPMN 分頁掛載 viewer 才耗資源(分頁未選取時不渲染 BpmnViewer)。
- **投影切換**:Switch/Toggle,預設 **off**(完整圖,已確認);on = `keep: ['form','condition']`(start/end 恆保留,濾掉 action)。
- **下載**:Blob(`application/xml`)+ 暫時 `<a download="flow.bpmn">`,下載**當前顯示**的 XML(投影開著就下載投影版)。
- **dark 模式**:沿用 bpmn-viewer tool 的既有模式 —— `bpmn-invert` className(`bg-white dark:bg-[#d4d4d4] dark:invert dark:hue-rotate-180`)+ 淡色填色 CSS 覆寫(`fill: #b9b9b9`)。該 CSS 字串目前 inline 在 `bpmn-viewer/ui.tsx`;因紅線不動共用檔,於 `bpmn-view.tsx` 本地複製一份並加註來源註解。
- viewer 控制:掛 `useBpmnViewer()` 的 fit/zoom 由 bpmn-ui 內建(importXML 後自動 fit-viewport),不另加 zoom 按鈕列(YAGNI;bpmn-js NavigatedViewer 本身可滾輪縮放/拖曳)。

### i18n 新鍵(`messages.ts`,en + zh-TW)

| 鍵 | en | zh-TW |
|---|---|---|
| `flowTabEdit` | Edit | 編輯 |
| `flowTabBpmn` | BPMN | BPMN |
| `flowBpmnProjection` | Human tasks only | 只看人工節點 |
| `flowBpmnDownload` | Download .bpmn | 下載 .bpmn |
| `flowBpmnLabel` | BPMN diagram | BPMN 流程圖 |
| `flowNodeStart` | Start | 開始 |
| `flowNodeEnd` | End | 結束 |
| `flowNodeForm` | Form | 表單 |
| `flowNodeCondition` | Condition | 條件 |
| `flowNodeAction` | Action | 動作 |
| `flowNodeFields` | `{count} fields` | `{count} 個欄位` |
| `flowNodeKind` | `kind: {kind}` | `種類:{kind}` |

placeholder 一律經 `t("key", { count })` 取值,不做 raw retrieve(next-intl raw 取含 `{}` 的訊息會在 runtime 炸掉)。

**注意**:`compileToBpmn` 產出的 BPMN `name`(Start/End/Form/Condition/Action)維持英文常數 —— XML 是匯出物、不是 UI 文案,不吃 i18n(也避免純函式對 locale 產生依賴)。

## 4. Minors

### 4a. `nodes.tsx` 標籤 i18n

- `META` 的 `label` 欄位移除;各節點元件內 `useTranslations("ToolUI")` 取 `flowNodeStart/…` 作為 Shell title。
- FormNode 的 `` `${fieldCount} fields` `` → `t("flowNodeFields", { count })`;ActionNode 的 `` `kind: ${kind}` `` → `t("flowNodeKind", { kind })`。
- `nodes.spec.tsx` 相應更新(測試 render 時包 NextIntlClientProvider,或沿用現有 spec 的做法)。

### 4b. `model.ts` nodeSeq → 純函式(採納偏離②)

```ts
export function nextNodeId(type: FlowNodeType, existingIds: string[]): string {
  const re = new RegExp(`^${type}-(\\d+)$`);
  const max = existingIds.reduce((m, id) => {
    const g = re.exec(id);
    return g ? Math.max(m, Number(g[1])) : m;
  }, 0);
  return `${type}-${max + 1}`; // 只跟同型別既有編號比,必不撞名
}

export function newNode(type: FlowNodeType, position: XY, existingIds: string[] = []): RFNode;
```

- 移除 module-level `let nodeSeq`。
- `ui.tsx` 呼叫端改 `newNode(type, pos, ns.map((n) => n.id))`。
- `model.spec.ts` 既有測試小改(已裁決):第二次呼叫傳入 `[a.id]`,斷言語意不變(連續新增 id 唯一);另補 `nextNodeId` 直接測試(空集合、跳號、非本型別 id 不干擾、`act-1` 這類不符 `action-N` 格式的 id 不影響)。

## 5. 測試策略

### 單元(vitest, jsdom 免用 —— 純函式)

- `projection.spec.ts`:keep 過濾、start/end 恆保留、單節點縮線、**鏈式**縮線(連續兩個被移除節點)、yes/no 平行邊不被去重、(source,target,label) 相同才去重、自環丟棄、原始邊欄位保留、輸入不被改動(immutability)。
- `bpmn.spec.ts` **結構性斷言**:
  - 必要元素齊全:definitions / process / BPMNDiagram / BPMNPlane。
  - 每個 FlowDoc 節點有對應 process 元素(型別正確)+ BPMNShape;每條邊有 sequenceFlow + BPMNEdge。
  - **id 引用完整性**:所有 `sourceRef`/`targetRef`/`bpmnElement`/`incoming`/`outgoing` 都指向存在的 id(以 regex/簡單 parse 收集 id 與引用後比對)。
  - id 皆為合法 NCName;name/label 特殊字元(`<`、`&`、`"`)被轉義。
  - DI 尺寸:start 36×36 中心對齊、condition 50×50、form/action 150×62;waypoints 為 source 右緣中心 → target 左緣中心。
  - condition 的 yes/no 兩條 outgoing sequenceFlow 帶 name。
  - 內建 sample 全量編譯 snapshot 級斷言(不用 vitest snapshot,列關鍵子字串即可,避免脆化)。

### 元件(vitest + testing-library)

- `bpmn-view.spec.tsx`:mock `@rfjs/bpmn-ui`(沿用 `bpmn-viewer/ui.spec.tsx` 的 mock 模式);驗:傳入 viewer 的 xml 含 `<bpmn:definitions`;切投影後 xml 中 serviceTask 消失;下載按鈕觸發(mock URL.createObjectURL)。
- `ui.spec.tsx`:分頁切換 —— 預設編輯分頁(有新增按鈕);切 BPMN 後出現 viewer、新增按鈕隱藏;切回編輯正常。

### e2e(playwright, port 3002, `pnpm -F web test:e2e`)

- 一條新 spec:進 `/tools/flow-builder` → 切「BPMN」分頁 → `.djs-container svg` 內有節點圖形(bpmn-js 真渲染成功)。

### 真渲染驗證(非自動化,PR 前執行)

- `next build` + `next start` → Playwright MCP 截圖 light + dark 各一張,確認:BPMN 圖形正確(小圓/菱形/圓角矩形、yes/no label)、dark 模式反轉可讀、投影切換生效。

## 6. 慣例

- Commit/PR 英文 conventional commits(subject 全小寫開頭),commit 結尾 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。
- 變更全屬 apps/web(private)→ **無 changeset**。
- PR 開好後 HOLD,由使用者自行 merge。
