import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useBpmnViewer } from "./use-bpmn-viewer";
import type { BpmnViewerHandle } from "./types";

describe("useBpmnViewer", () => {
  it("returns viewerProps with a ref and the two handlers", () => {
    const { result } = renderHook(() => useBpmnViewer());
    expect(result.current.viewerProps).toHaveProperty("ref");
    expect(typeof result.current.viewerProps.onLoadingChange).toBe("function");
    expect(typeof result.current.viewerProps.onError).toBe("function");
  });

  it("proxies zoom actions to the attached ref handle", () => {
    const { result } = renderHook(() => useBpmnViewer());
    const handle: BpmnViewerHandle = {
      zoomIn: vi.fn(),
      zoomOut: vi.fn(),
      resetZoom: vi.fn(),
      fitViewport: vi.fn(),
      getZoom: vi.fn(() => 1),
      getViewer: vi.fn(() => null),
    };
    result.current.viewerProps.ref.current = handle;
    act(() => result.current.zoomIn());
    act(() => result.current.zoomOut());
    act(() => result.current.resetZoom());
    act(() => result.current.fitViewport());
    expect(handle.zoomIn).toHaveBeenCalledTimes(1);
    expect(handle.zoomOut).toHaveBeenCalledTimes(1);
    expect(handle.resetZoom).toHaveBeenCalledTimes(1);
    expect(handle.fitViewport).toHaveBeenCalledTimes(1);
  });

  it("zoom actions are safe no-ops before a viewer is attached (ref still null)", () => {
    const { result } = renderHook(() => useBpmnViewer());
    expect(result.current.viewerProps.ref.current).toBeNull();
    expect(() => {
      act(() => result.current.zoomIn());
      act(() => result.current.zoomOut());
      act(() => result.current.resetZoom());
      act(() => result.current.fitViewport());
    }).not.toThrow();
  });

  it("tracks importing state and clears error when a new load starts", () => {
    const { result } = renderHook(() => useBpmnViewer());
    act(() => result.current.viewerProps.onError({ message: "x" }));
    expect(result.current.error).toEqual({ message: "x" });
    act(() => result.current.viewerProps.onLoadingChange(true));
    expect(result.current.importing).toBe(true);
    expect(result.current.error).toBeNull();
    act(() => result.current.viewerProps.onLoadingChange(false));
    expect(result.current.importing).toBe(false);
  });
});
