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
  /**
   * 透傳給 NavigatedViewer 建構子的額外選項。
   * @warning 請務必將此物件 memoize(例如 `useMemo`)。若每次 render 都傳入新的 inline 物件,
   * viewer 將在每次 render 時被銷毀並重新建立。
   */
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
