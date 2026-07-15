# 視覺統一輪(D2 studio)— 設計

- 日期:2026-07-13
- 狀態:設計待審
- 範圍:apps/web only,15 個 showcase 工具
- Mockup:`scratchpad/2026-07-13-visual-unification-directions.html`(方向 **D2** 定案;dark/light 截圖 vu-dark/vu-light.png)

## 一句話

把 15 個 surface:'web' 工具的「工具外殼」視覺語彙統一到 metadata-studio 樣式(D2):抽出 `ToolEyebrow` / `SectionCard` / `ToolTabs` 三個共用元件,收掉現存 5 種手刻區塊卡與被複製的 tab bar,並統一 ToolIntro 的 wrap。

## 背景(現狀不一致,已盤點)

- **同一「區塊卡」概念有 5 種手刻實作**:web-ui `Panel`(6 個 ToolShell 工具用)、filter-builder 家族的 `SampleCard`/`QueryOutputPanel`/inline sections、decision-table 土砲卡(`rounded-md`、無 mono/uppercase)、form-builder 的 `Section`、metadata-studio 的 tab-strip 卡。border-radius / padding / 標題字體全在飄。
- **eyebrow 只有 1/15**(decision-table);`data-filter-builder` 有一個從未渲染的 dead `dfbEyebrow` 字串。
- **頂層 tab bar** 被逐字複製 3–4 份(table-builder / form-builder / flow-builder),無共用元件。
- **ToolIntro wrap 兩種深度**:#254 rollout 外包一層 `flex flex-col gap-4` div;tb/mb 則是 ToolIntro 當既有 root 的 sibling。
- **唯一已一致** = `AiPanel`(12/15 同一元件)。

## 目標視覺(D2)

metadata-studio 語彙:區塊卡 = slab(`bg-muted/30`)表頭;單標題用 mono-uppercase(`font-mono text-xs uppercase tracking-wide text-muted-foreground`);多視圖用 tab-strip 底線高亮(active = `text-primary` + `border-b-2 border-primary` + `bg-card`);次級/inspector 用 dashed border;輸出狀態用 gold fragment bar(`bg-primary/10`)。block rhythm:單一 root `flex flex-col gap-4`,eyebrow → ToolIntro → AI → 卡片,全 flat sibling。

## 元件設計(`apps/web/src/components/shared/`)

### `ToolEyebrow`
```tsx
function ToolEyebrow({ children }: { children: React.ReactNode }): JSX.Element
// <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
```
取代散落的 bare `<p className="text-xs font-semibold tracking-widest text-muted-foreground">{t("xEyebrow")}</p>`。

### `SectionCard`(唯一區塊卡)
```tsx
type SectionTab = { id: string; label: string };
function SectionCard(props: {
  title?: string;              // solo 模式:slab + mono-uppercase 單標題
  tabs?: SectionTab[];         // tab 模式:tab-strip 底線高亮(與 title 二擇一)
  activeTab?: string;
  onTabChange?: (id: string) => void;
  action?: React.ReactNode;    // 表頭右側(如 raw(2) / Copy)
  children: React.ReactNode;   // body(p-4)
}): JSX.Element
```
- 外殼:`rounded-lg border bg-card overflow-hidden`(統一 radius);表頭 slab `bg-muted/30 border-b`;body `p-4`。
- `title` → 單標題列(mono-uppercase + 右側 action)。`tabs` → tab-strip 表頭。二者互斥。
- 取代:6 個 ToolShell 工具的 web-ui `Panel`、filter-builder 家族手刻卡、decision-table 土砲卡、form-builder `Section`、es-client-demo ad-hoc sections。
- `ToolShell`(operation-chip + 雙欄佈局)**保留**作那 6 個 transform 工具的版面容器,但它的 `input`/`output` 由 `Panel` 換成 `SectionCard`。

### `ToolTabs`(頂層分頁切換)
```tsx
function ToolTabs(props: {
  tabs: SectionTab[];
  active: string;
  onChange: (id: string) => void;
}): JSX.Element
// 收斂被複製的 `inline-flex w-fit gap-0.5 rounded-lg border border-input bg-muted/30 p-1` segmented bar
```
本輪消費者:form-builder(唯一在 15 內用頂層 tab bar 的)。table-builder / flow-builder 之後採用(本輪不動)。

## ToolIntro wrap 統一

canonical = **ToolIntro 當單一 `flex flex-col gap-4` root 的第一個 child**(tb/mb 樣式)。15 工具中 #254 多包了一層外 div 的,移除那層外 div,讓 ToolIntro 與工具本體同層(收掉 #254 review 留下的 cosmetic wrapper minor)。

## 範圍與 tier 對照(15 showcase 工具)

| tier | 工具 | 現況 → 本輪 |
|---|---|---|
| ToolShell+Panel(6) | data-filter-tester, jwt-decoder, type-converter, object-flatten, jsonb-query-generator, mongo-query-generator | Panel → SectionCard(ToolShell 保留);+ ToolEyebrow;統一 wrap |
| filter-builder 家族(6) | data-filter-builder, sql-filter-builder, jsonb-query-builder, mongo-query-builder, pg-filter-builder, es-query-builder | 手刻卡 → SectionCard;+ ToolEyebrow;統一 wrap;移除各自 inline `<style>{RISE}</style>` 若卡片動畫改由 SectionCard 統一提供(或保留為選配,實作決定) |
| filter-builder no-AI(1) | es-client-demo | ad-hoc sections → SectionCard;+ ToolEyebrow;統一 wrap |
| bespoke(1) | decision-table | 土砲卡 → SectionCard(已有 eyebrow,保留);統一 wrap |
| canvas(1) | form-builder | `Section` → SectionCard;頂層 tab bar → ToolTabs;+ ToolEyebrow;統一 wrap;drag/drop 畫布本身不動 |

**不在本輪**:metadata-builder(D2 本尊/視覺參照,不動)、table-builder(已有 studio 外殼;其 plain panels 留作小 follow-up)、flow-builder / bpmn-viewer(BPM 專案)。

## 變更清單

- Create:`ToolEyebrow.tsx`、`section-card.tsx`、`tool-tabs.tsx`(+ 各 `*.spec.tsx`)於 `apps/web/src/components/shared/`。
- Modify:15 工具的 `ui.tsx`(換元件 + 統一 wrap + 加 eyebrow),必要時其子 panel 檔;filter-builder 家族的 `_filter-builder/*` 共用子元件改用 SectionCard;`data-filter-builder/messages.ts` 移除 dead `dfbEyebrow`。各工具需要新的 eyebrow i18n key(沿用既有 `<x>Eyebrow` 命名;唯一前綴,en+zh-TW)。
- changeset:`web` patch 一份。

## 測試 / 驗收
- 元件:`SectionCard`(solo/tab 兩模式渲染 + action slot)、`ToolTabs`(切換 + active)、`ToolEyebrow` 各自 spec。
- 每工具既有測試維持綠(視覺替換,不改行為);若測試斷言了舊卡片的 DOM 結構(class/標題),更新為對應新結構。
- 全套 `pnpm -F web test && check-types && lint` 綠。
- 截圖對照:每個 tier 至少一個代表工具(ToolShell 系、filter-builder 家族、decision-table、form-builder、es-client-demo),dark/light;與 metadata-builder 並排確認語彙一致。
- `grep` 確認無殘留手刻卡 recipe(`rounded-md border`+`text-sm font-semibold` 標題等)於已改工具;無 dead eyebrow。

## 明確不做
- 不動 metadata-builder(參照)、table-builder deep panels、flow-builder / bpmn-viewer。
- 不改工具的功能/邏輯/資料流 —— 純視覺外殼。
- 不做每工具的深度重塑(list/inspector 化、動畫細修)——留給後續逐工具輪。
- 不把 primitive 放進 `@rfjs/web-ui`(這些是 app 組合層,依 app token/i18n;web-ui 的 `Panel` 保留給其他潛在消費者,但 tool 內不再直接用)。
