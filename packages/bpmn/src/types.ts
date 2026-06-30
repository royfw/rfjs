import type { CSSProperties } from "react";

export interface BpmnImportResult {
  warnings: unknown[];
}

export interface BpmnViewerError {
  message: string;
  warnings?: unknown[];
  cause?: unknown;
}

export interface BpmnViewerProps {
  /** 受控的 BPMN 2.0 XML 字串。 */
  xml: string;
  /** 透傳給 NavigatedViewer 建構子的額外選項。 */
  options?: Record<string, unknown>;
  className?: string;
  style?: CSSProperties;
  onImport?: (result: BpmnImportResult) => void;
  onError?: (error: BpmnViewerError) => void;
  onLoadingChange?: (loading: boolean) => void;
}

export interface BpmnViewerHandle {
  zoomIn(): void;
  zoomOut(): void;
  resetZoom(): void;
  fitViewport(): void;
  getZoom(): number;
  /** 逃生艙:回傳底層 NavigatedViewer 實例(未建立時為 null)。 */
  getViewer(): unknown;
}
