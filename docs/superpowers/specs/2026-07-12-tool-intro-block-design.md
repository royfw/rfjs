# `<ToolIntro>` 工具功能說明區塊 — 設計

- 日期:2026-07-12
- 狀態:設計待審
- Mockup:`scratchpad/2026-07-12-tool-intro-block.html`(intro-dark.png / intro-light.png)—— 形態 **V1 摺疊 callout**
- 關係:app-level 共用元件;table-builder 的文案描述 ② 的資源模型 → table-builder 接線與 ② 併同一 apps/web PR;metadata-builder 接線獨立(可隨附)。

## 一句話

新增一個共用元件 `<ToolIntro>`:預設收合的「這個工具怎麼運作?」callout,展開顯示幾個概念格,可關且用 localStorage 記住;先接 table-builder 與 metadata-builder(S1)。

## 動機

- 全套件目前的功能說明只有 `PageHeader` 一句話(`Tools.<id>.description`)+ 面板旁零星 `text-xs` 微提示,**沒有**「怎麼運作」層級的說明區塊。
- ② 的資源為中心模型引入新概念(**資源 ± 協定**、**離線 / live**),一句話不夠;需要可展開的解釋,但不該常駐佔空間。

## 元件設計

`apps/web/src/components/shared/tool-intro.tsx`(與 `page-header.tsx` 同層):

```tsx
type ToolIntroConcept = { term: string; desc: string };
type ToolIntroProps = {
  storageKey: string;          // e.g. "tool-intro:table-builder" — 記住收合/關閉
  question: string;            // 摘要行主文:「這個工具怎麼運作?」
  tagline?: string;            // 摘要行灰字:「一份資源(± 協定)→ 表格設定 → 預覽」
  concepts: ToolIntroConcept[];// 展開後的概念格(2–3 個)
  dismissible?: boolean;       // 預設 true,顯示 ✕ 永久關閉
};
```

- 收合態:一行 —— info icon + `question` + 灰字 `tagline` + 「收合/展開」chevron。
- 展開態:concepts 以 responsive grid(桌機 N 欄、窄螢幕堆疊)呈現,每格 `term`(accent 色)+ `desc`(muted)。
- 狀態:`{ open: boolean; dismissed: boolean }` 存 localStorage(key = `storageKey`);`dismissed` 後整塊不再渲染。**預設收合**(open=false),避免首屏被佔。
- 排版:`@rfjs/web-ui` 既有 token/typography;沿用 tool body 慣用的 `text-xs/text-sm text-muted-foreground`。無新設計系統元件。
- 純受控於自身 localStorage,不需外部狀態;SSR 安全(讀 localStorage 前先掛載,如既有 metadata-builder 的 restoredRef 模式)。

## 接線(S1 — 只這兩個工具)

置於各 `ui.tsx` 的 eyebrow 之後、tabs 之前。

- **table-builder**(`ui.tsx` eyebrow 後):
  - question:「這個工具怎麼運作?」 tagline:「一份資源(± 協定)→ 表格設定 → 預覽」
  - concepts:①資源(來源 import/貼/author)②協定(有=可查詢 endpoint;無=純靜態 rows)③預覽(離線=對範本模擬協定;live=真打端點)。
  - storageKey `tool-intro:table-builder`。文案描述 ② 的模型 → 與 ② 同 PR。
- **metadata-builder**(`ui.tsx` eyebrow 後):
  - question:「這個工具怎麼運作?」 tagline:「編一份資源 metadata → 交付 meta.json」
  - concepts:①欄位(kind/dataType/enum/filterable)②協定(request/response,可試打)③交付(匯出 meta.json 給任何 consumer,如 table-builder)。
  - storageKey `tool-intro:metadata-builder`。

## i18n
- 每工具 `messages.ts` 新增 intro 文案 key(question 可共用一把、tagline + concepts 各工具自帶),en + zh-TW;`{count}` 無關(純靜態字串)。沿用共享 `ToolUI` namespace。

## 明確不做(YAGNI)
- 不套其餘工具(decision-table/form/flow/…)—— S1;元件設計成可複用,日後逐一接。
- 不做 tooltip / docs 連結 / 圖示系統 / markdown 內文 —— 只有 question + tagline + concept 格。
- 不改 `PageHeader` 或 `ToolDefinition` registry(說明仍走 i18n,不進 registry)。
- 無 packages 變更 → 無 changeset。

## 驗收
- `<ToolIntro>` 預設收合;展開顯示概念格;✕ 關閉後重整不再出現(localStorage)。
- table-builder / metadata-builder 各自顯示對應文案,en + zh-TW 皆正確。
- `pnpm -F web check-types && lint && test` 全過;新增元件 spec(collapse/dismiss/localStorage 行為)。
- 截圖:兩工具收合態 + 展開態、dark/light。

## 依賴/順序
① data-schema-ui → ② 資源 UX(+ 本 ③ 的 table-builder 接線同 PR)。metadata-builder 的 ③ 接線可在同 PR 一併做。
