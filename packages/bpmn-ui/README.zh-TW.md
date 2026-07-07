# @rfjs/bpmn-ui

封裝 [`bpmn-js`](https://github.com/bpmn-io/bpmn-js) `NavigatedViewer` 的無頭 React 元件 —— 唯讀 BPMN 2.0 流程圖檢視器。Private workspace 套件,透過 Next.js `transpilePackages` 消費(無 build step)。

> **授權:** `bpmn-js` 採用 [bpmn.io 授權](https://bpmn.io/license/)。檢視器會顯示「Powered by bpmn.io」標誌,**請勿隱藏**。

## 用法

```tsx
import { BpmnViewer, useBpmnViewer } from "@rfjs/bpmn-ui";

function Demo({ xml }: { xml: string }) {
  const v = useBpmnViewer();
  return (
    <div>
      <button onClick={v.zoomIn}>+</button>
      <button onClick={v.fitViewport}>fit</button>
      <BpmnViewer {...v.viewerProps} xml={xml} className="h-[600px] w-full" />
      {v.error && <p role="alert">{v.error.message}</p>}
    </div>
  );
}
```

## API

- `<BpmnViewer>` —— 受控元件;`ref` 提供 `BpmnViewerHandle`(`zoomIn`/`zoomOut`/`resetZoom`/`fitViewport`/`getZoom`/`getViewer`)。
- `useBpmnViewer()` —— 回傳 `{ viewerProps, zoomIn, zoomOut, resetZoom, fitViewport, importing, error }`;把 `viewerProps` spread 到 `<BpmnViewer>`。

容器需有明確高度才能渲染。
