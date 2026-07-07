# @rfjs/bpmn-ui

Headless React wrapper around [`bpmn-js`](https://github.com/bpmn-io/bpmn-js) `NavigatedViewer` — a read-only BPMN 2.0 diagram viewer. Private workspace package, consumed via Next.js `transpilePackages` (no build step).

> **License:** `bpmn-js` is distributed under the [bpmn.io license](https://bpmn.io/license/). The viewer renders a "Powered by bpmn.io" badge; **do not hide it**.

## Usage

```tsx
import { BpmnViewer, useBpmnViewer } from "@rfjs/bpmn-ui";

function Demo({ xml }: { xml: string }) {
  const v = useBpmnViewer();
  return (
    <div>
      <button onClick={v.zoomIn}>+</button>
      <button onClick={v.zoomOut}>-</button>
      <button onClick={v.fitViewport}>fit</button>
      <BpmnViewer {...v.viewerProps} xml={xml} className="h-[600px] w-full" />
      {v.error && <p role="alert">{v.error.message}</p>}
    </div>
  );
}
```

## API

- `<BpmnViewer xml options className style onImport onError onLoadingChange ref />` — controlled component. The `ref` exposes `BpmnViewerHandle` (`zoomIn`/`zoomOut`/`resetZoom`/`fitViewport`/`getZoom`/`getViewer`).
- `useBpmnViewer()` — returns `{ viewerProps, zoomIn, zoomOut, resetZoom, fitViewport, importing, error }`. Spread `viewerProps` onto `<BpmnViewer>`.

The container needs an explicit height to render.
