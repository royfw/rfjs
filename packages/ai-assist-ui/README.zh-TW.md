# @rfjs/ai-assist-ui

> English → [README.md](./README.md)

[@rfjs/ai-assist](../ai-assist) 之上的輕量 **React** 層:一個 `useAiAssist()`
hook(對已設定的 BYOK 連線發出 run/runStream,附帶 loading / error / 串流狀
態)與一個 `<AiPanel>` 外殼(可收合區塊、提示輸入框、動作按鈕、串流預覽,以及
可重新套用的互動紀錄)。它**只持有 UI 與請求狀態**——設定儲存、
`complete`/`stream` client、auth 策略、互動紀錄 store 全都在 `ai-assist`。

> **私有 / 內部套件。** 不發布到 npm。在 monorepo 內透過 Next.js
> `transpilePackages` 以 `src` 直接消費(免 build)。Peer 相依:`react`、
> `react-dom`。

---

## 用法

```tsx
"use client";
import { useAiAssist, AiPanel, type AiPanelAction } from "@rfjs/ai-assist-ui";

export function MyToolAiBlock({ config, applyConfig }: MyToolProps) {
  const ai = useAiAssist();

  const actions: AiPanelAction[] = [
    {
      key: "generate",
      label: "產生",
      needsInput: true,
      primary: true,
      run: async (input) => {
        const out = await ai.run(
          { system: "...", user: buildPrompt(input, config), json: true },
          parseGeneratedConfig,
        );
        if (out === null) return null; // ai.error 已被設定
        applyConfig(out);
        return {
          kind: "generate",
          prompt: input,
          appliedJson: JSON.stringify(out),
        };
      },
    },
    {
      key: "ask",
      label: "詢問",
      needsInput: true,
      run: async (input) => {
        const out = await ai.runStream(
          { system: "...", user: buildAskPrompt(input, config) },
          (raw) => raw.trim(),
        );
        return out === null
          ? null
          : { kind: "ask", prompt: input, answer: out };
      },
    },
  ];

  return (
    <AiPanel
      title="AI 輔助"
      placeholder="描述你想要的內容…"
      logKey="rfjs.ai.log.my-tool"
      ai={ai}
      actions={actions}
      onReapply={(entry) =>
        applyConfig(JSON.parse(entry.appliedJson ?? "null"))
      }
      appliedSummary={(entry) => `已套用(${entry.at})`}
      labels={{
        kindGenerate: "產生",
        kindAsk: "詢問",
        kindExplain: "說明",
        kindCheck: "檢查",
        cancel: "取消",
        notConfigured: "尚未設定 AI —— 請至設定新增連線。",
        viewRaw: "檢視原始回應",
        thinking: "思考中…",
        answers: "AI 回覆",
        advisory: "僅供參考",
        clear: "清除",
        reapply: "重新套用",
      }}
    />
  );
}
```

`useAiAssist()` 透過 `@rfjs/ai-assist` 的 `loadAiSettings()` /
`subscribeAiSettings()` 讀取 BYOK 連線,所以使用者在同分頁儲存設定的當下
`ready` 就會變成 `true`——不必重新整理。`run()` 是單次請求(搭配
`json: true` 用於結構化的「產生」動作);`runStream()` 是 SSE 版本——串流
過程中會更新 `ai.streamText` / `ai.streamReasoning`,等完整文字到齊才呼叫
一次 `parse()`。兩者都會在啟動新請求前,先取消同一個 hook 實例上尚在進行
的請求,並忽略 `kind` 為 `'abort'` 的 `AiError`(使用者主動取消不算錯誤)。

## `useAiAssist()` 回傳形狀(`UseAiAssist`)

| 欄位                    | 型別                                                        | 用途                                                                     |
| ----------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------ |
| `ready`                 | `boolean`                                                   | 已設定 BYOK 連線後為 `true`(SSR 安全:伺服器端一律 `false`)               |
| `loading`               | `boolean`                                                   | 有 `run`/`runStream` 呼叫正在進行                                        |
| `error`                 | `AiError \| null`                                           | 最後一次錯誤(`kind`:`'config'` `'http'` `'timeout'` `'abort'` `'parse'`) |
| `streamText`            | `string`                                                    | `runStream` 期間累積的文字(非串流期間為空)                               |
| `streamReasoning`       | `string`                                                    | 累積的推理/思考文字,前提是 gateway 有透傳 `reasoning_content`            |
| `cancel()`              | `() => void`                                                | 取消進行中的請求                                                         |
| `run(req, parse)`       | `<T>(req, parse: (raw: string) => T) => Promise<T \| null>` | 單次請求,完成後對原始文字 `parse()`;錯誤/取消時回傳 `null`(檢查 `error`) |
| `runStream(req, parse)` | 同簽名                                                      | SSE 版本;串流期間更新 `streamText`/`streamReasoning`,完成後才 `parse()`  |

`req` 是 `@rfjs/ai-assist` 的 `CompleteRequest` 扣掉 `signal`(hook 自己提供
`AbortController`)。

## `<AiPanel>` props

| prop              | 型別                               | 用途                                                                                             |
| ----------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------ |
| `title`           | `string`                           | 收合 chevron 旁的標題文字                                                                        |
| `placeholder`     | `string`                           | 提示輸入框的 placeholder                                                                         |
| `actions`         | `AiPanelAction[]`                  | 依陣列順序渲染的按鈕;最後一個 `needsInput` 動作與第一個非 `needsInput` 動作之間會插入分隔線      |
| `logKey`          | `string`                           | 這個面板互動紀錄的儲存 key(`createAiLog(logKey)`)——依工具區隔,例如 `"rfjs.ai.log.table-builder"` |
| `ai`              | `ReturnType<typeof useAiAssist>`   | 驅動此面板的 hook 實例                                                                           |
| `onReapply?`      | `(entry: AiAssistEntry) => void`   | 對有 `appliedJson` 的紀錄顯示「重新套用」按鈕                                                    |
| `appliedSummary?` | `(entry: AiAssistEntry) => string` | 對有 `appliedJson` 的紀錄,取代原始回答顯示的文字                                                 |
| `labels`          | `AiPanelLabels`                    | 所有 UI 字串(labels-as-props;見下)                                                               |

面板本身是自足的:持有自己的提示框文字、開合狀態(以瀏覽器為單位存於
`AI_BLOCK_OPEN_KEY`,掛載後才還原以維持 SSR/hydration 安全),以及互動紀錄
清單(掛載時從 `createAiLog(logKey)` 載入,每次動作成功後附加)。在輸入框
按下 **Enter**(未按 Shift、不在 IME 組字中)會執行第一個 `needsInput: true`
的動作。

### `AiPanelAction`

```ts
interface AiPanelAction {
  key: string;
  label: string;
  needsInput?: boolean; // 輸入框有文字前停用;同時綁定 Enter 執行
  primary?: boolean; // 以「default」(填色)按鈕樣式渲染
  run: (input: string) => Promise<Omit<AiAssistEntry, "id" | "at"> | null>;
}
```

當請求失敗或被取消時,`run` 回傳 `null`——面板本身已讀取 `ai.error`,不必
在 `run` 裡重複錯誤畫面。回傳部分 `AiAssistEntry`(不含 `id`/`at`——由面板
蓋章)以附加一筆紀錄;若動作已把結果套用到呼叫端自己的狀態,帶上
`appliedJson`(驅動 `appliedSummary`/`onReapply`);純顯示的回答(如
`ask`/`explain`)則帶 `answer`。

### `AiPanelLabels`

```ts
interface AiPanelLabels {
  kindGenerate: string;
  kindAsk: string;
  kindExplain: string;
  kindCheck: string;
  cancel: string;
  notConfigured: string;
  viewRaw: string;
  thinking: string;
  answers: string;
  advisory: string;
  clear: string;
  reapply: string;
}
```

面板渲染的每一個字串都是必填 prop——不綁定任何內建 i18n 框架(不依賴
`next-intl`/`react-intl`)。呼叫端可以傳入自己的翻譯函式產出的任何字串,所
以面板在 next-intl、純字典,或測試裡的硬編碼字串表下都能一樣運作。

## 其他匯出

- **`AI_BLOCK_OPEN_KEY`** —— 面板用來跨造訪持久化開合狀態的 `localStorage`
  key(`"rfjs.ai.block.open"`)。

## 相關套件

- **[@rfjs/ai-assist](../ai-assist)** —— 本面板渲染的框架無關 client、設定儲
  存、auth 策略,以及互動紀錄 store。
- **[@rfjs/web-ui](../web-ui)** —— 上樣式用的設計 token 與元件(`Button`、
  `Textarea`)。
