"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import "bpmn-js/dist/assets/diagram-js.css";
import "bpmn-js/dist/assets/bpmn-js.css";
import "bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css";

import { ZOOM_FACTOR, zoomBy } from "./zoom";
import type { BpmnViewerError, BpmnViewerHandle, BpmnViewerProps } from "./types";

interface BpmnCanvas {
  zoom(level?: number | string, center?: unknown): number;
}
interface BpmnInstance {
  importXML(xml: string): Promise<{ warnings?: unknown[] }>;
  get(name: string): unknown;
  destroy(): void;
}

export const BpmnViewer = forwardRef<BpmnViewerHandle, BpmnViewerProps>(
  function BpmnViewer({ xml, options, className, style, onImport, onError, onLoadingChange }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewerRef = useRef<BpmnInstance | null>(null);
    const importSeq = useRef(0);
    const [ready, setReady] = useState(false);

    // 把最新 callback 收進 ref,避免 inline callback 造成 import effect 反覆重跑。
    const cbRef = useRef({ onImport, onError, onLoadingChange });
    cbRef.current = { onImport, onError, onLoadingChange };

    // 建立 / 銷毀 viewer(client-only;動態 import 確保 SSR 不觸碰 bpmn-js)。
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;
      let cancelled = false;
      let created: BpmnInstance | null = null;

      void (async () => {
        const mod = await import("bpmn-js/lib/NavigatedViewer");
        if (cancelled) return;
        const NavigatedViewer = mod.default as new (opts: Record<string, unknown>) => BpmnInstance;
        created = new NavigatedViewer({ container, ...(options ?? {}) });
        viewerRef.current = created;
        setReady(true);
      })();

      return () => {
        cancelled = true;
        if (created) created.destroy();
        viewerRef.current = null;
        setReady(false);
      };
    }, [options]);

    // viewer 就緒或 xml 變更 → import(含競態保護 + unmount 保護)。
    useEffect(() => {
      const viewer = viewerRef.current;
      if (!ready || !viewer || !xml) return;
      const seq = ++importSeq.current;
      let active = true;
      cbRef.current.onLoadingChange?.(true);
      viewer
        .importXML(xml)
        .then((result) => {
          if (!active || seq !== importSeq.current) return;
          // 注意:被 seq 超越的過期 import 刻意不呼叫 onLoadingChange(false),
          // 因為勝出的那次 import 會自行結束 loading 狀態。
          cbRef.current.onLoadingChange?.(false);
          (viewer.get("canvas") as BpmnCanvas).zoom("fit-viewport");
          cbRef.current.onImport?.({ warnings: result?.warnings ?? [] });
        })
        .catch((err: unknown) => {
          if (!active || seq !== importSeq.current) return;
          cbRef.current.onLoadingChange?.(false);
          const e: BpmnViewerError = {
            message: err instanceof Error ? err.message : String(err),
            warnings: (err as { warnings?: unknown[] })?.warnings,
            cause: err,
          };
          cbRef.current.onError?.(e);
        });
      return () => {
        active = false;
      };
    }, [ready, xml]);

    useImperativeHandle(
      ref,
      (): BpmnViewerHandle => {
        const canvas = (): BpmnCanvas | null =>
          (viewerRef.current?.get("canvas") as BpmnCanvas | undefined) ?? null;
        return {
          zoomIn() {
            const c = canvas();
            if (c) c.zoom(zoomBy(c.zoom(), ZOOM_FACTOR));
          },
          zoomOut() {
            const c = canvas();
            if (c) c.zoom(zoomBy(c.zoom(), 1 / ZOOM_FACTOR));
          },
          resetZoom() {
            canvas()?.zoom("fit-viewport");
          },
          fitViewport() {
            canvas()?.zoom("fit-viewport");
          },
          getZoom() {
            return canvas()?.zoom() ?? 1;
          },
          getViewer() {
            return viewerRef.current;
          },
        };
      },
      [],
    );

    return <div ref={containerRef} className={className} style={style} />;
  },
);
