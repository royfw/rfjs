"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";

import type { BpmnViewerError, BpmnViewerHandle } from "./types";

export interface UseBpmnViewer {
  /** 直接 spread 到 <BpmnViewer> 的 props(ref + 內部 handler)。 */
  viewerProps: {
    ref: RefObject<BpmnViewerHandle | null>;
    onLoadingChange: (loading: boolean) => void;
    onError: (error: BpmnViewerError) => void;
  };
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  fitViewport: () => void;
  importing: boolean;
  error: BpmnViewerError | null;
}

export function useBpmnViewer(): UseBpmnViewer {
  const ref = useRef<BpmnViewerHandle | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<BpmnViewerError | null>(null);

  const onLoadingChange = useCallback((loading: boolean) => {
    setImporting(loading);
    if (loading) setError(null);
  }, []);
  const onError = useCallback((e: BpmnViewerError) => setError(e), []);

  const zoomIn = useCallback(() => ref.current?.zoomIn(), []);
  const zoomOut = useCallback(() => ref.current?.zoomOut(), []);
  const resetZoom = useCallback(() => ref.current?.resetZoom(), []);
  const fitViewport = useCallback(() => ref.current?.fitViewport(), []);

  const viewerProps = useMemo(
    () => ({ ref, onLoadingChange, onError }),
    [onLoadingChange, onError],
  );

  return { viewerProps, zoomIn, zoomOut, resetZoom, fitViewport, importing, error };
}
