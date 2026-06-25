# @rfjs/filter-builder-ui

> English → [README.md](./README.md)

[@rfjs/filter-builder](../filter-builder) 之上的輕量 **React** 層:一個 `<FilterTreeEditor>` 元件(以及它用到的 `useFilterTree()` hook 與值/欄位編輯器),用 [@rfjs/web-ui](../web-ui) 上樣式。它**只負責編輯/持有樹**——所有邏輯(tree-ops、schema、編譯、比對)都在 `filter-builder`。同一個元件靠 `engineId` prop 就能編輯**任一**引擎的樹。

> **私有 / 內部套件。** 不發布到 npm。在 monorepo 內透過 Next.js `transpilePackages` 以 `src` 直接消費(免 build)。Peer 相依:`react`、`react-dom`。

---

## 用法

```tsx
"use client";
import { FilterTreeEditor, useFilterTree } from "@rfjs/filter-builder-ui";
import { getEngine, treeToFilterGroup } from "@rfjs/filter-builder";

export function MyEditor() {
  const { tree, schema, setTree, setSchema, createField } = useFilterTree();

  // 需要查詢時才編譯(邏輯都在 filter-builder)
  const out = getEngine("jsonb").compile(
    treeToFilterGroup(tree),
    { fields: schema.map((f) => ({ path: f.path, kind: f.kind, dataType: f.dataType, elementType: f.elementType })) },
  );

  return (
    <FilterTreeEditor
      group={tree}
      engineId="jsonb"
      schema={schema}
      onChange={setTree}
      onCreateField={createField}
      labels={{
        logic: { and: "ALL", or: "ANY", nor: "NONE", not: "NOT" },
        addCondition: "+ 條件", addGroup: "+ 群組",
        removeGroup: "移除群組", removeCondition: "移除條件",
        elemMatch: "elemmatch",
      }}
    />
  );
}
```

## `<FilterTreeEditor>` props

| prop | 型別 | 用途 |
|------|------|------|
| `group` | `BuilderGroup` | 要渲染 / 編輯的樹 |
| `engineId` | `EngineId` | 提供哪個引擎的 operator(`"jsonb"` `"data-filter"` `"sql-filter"` `"mongo"` `"pg-filter"`) |
| `schema` | `FieldSchema[]` | 已知欄位 —— 驅動欄位 combobox、operator 可用性,以及(pg-filter)column/jsonb 種類 |
| `onChange` | `(next: BuilderGroup) => void` | 每次編輯都以新樹回呼 |
| `onCreateField` | `(path: string) => void` | 使用者輸入了 `schema` 沒有的欄位路徑 |
| `labels` | `FilterTreeLabels` | 所有 UI 字串(labels-as-props;見下) |
| `onRemove?` / `depth?` | — | 內部用(遞迴) |

元件是全受控的 —— 除了每個群組的「收合」檢視旗標外不持有任何樹狀態(收合是純檢視,不會寫進 `BuilderGroup`)。

## `FilterTreeLabels`

```ts
interface FilterTreeLabels {
  logic: Record<"and"|"or"|"nor"|"not", string>;
  addCondition: string; addGroup: string;
  removeGroup: string; removeCondition: string;
  elemMatch: string;
  valueHint?: string;                       // list/tag 輸入的 placeholder
  // 群組收合:
  toggleGroup?: string;                     // chevron 的 aria-label
  collapsedConditions?: string;             // 單位詞,如 "條件" → "2 條件"
  collapsedGroups?: string;                 // 單位詞,如 "群組" → "1 群組"
  collapsedEmpty?: string;                  // 空群組摘要
  // operator 多語系:
  operatorLabels?: Record<string, string>;  // op key → 在地化標籤(缺則顯示 raw op)
}
```

> `collapsed*` 是**單位詞**,不是 `{count}` 模板 —— 數字由元件前綴。(next-intl 會把 `{count}` 當 ICU 變數,沒帶值就會丟錯。)

## 其他匯出

- **`useFilterTree(init?)`** → `{ tree, schema, setTree, setSchema, createField }` —— 最小狀態持有(包 `filter-builder` 的 `emptyGroup` / `addInferredField`)。
- **`ValueEditor`** —— 依型別/arity 的值輸入(單值、range、tag/list)。
- **`FieldCombobox`** —— 可即打即建的欄位選擇器。
- **`OPERATOR_KEYS`** —— 標準 operator key 清單;用它組 `operatorLabels`(`Object.fromEntries(OPERATOR_KEYS.map(k => [k, t(k)]))`)。
- **`colors`** —— `logicBadge`、`dataTypeBadge`、`dataTypeShort`、`logicColor`、`dataTypeColor`。

## 相關套件

- **[@rfjs/filter-builder](../filter-builder)** —— 本元件渲染的邏輯/資料層(tree-ops、引擎、編譯、operator 矩陣)。
- **[@rfjs/web-ui](../web-ui)** —— 上樣式用的設計 token 與元件。
