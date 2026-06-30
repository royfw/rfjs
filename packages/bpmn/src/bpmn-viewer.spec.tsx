import { render, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BpmnViewer } from "./bpmn-viewer";
import type { BpmnViewerHandle } from "./types";

// 共享的 mock 函式,讓我們跨實例斷言呼叫。
const ctor = vi.fn();
const importXML = vi.fn();
const destroy = vi.fn();
const zoom = vi.fn(() => 1);
const canvas = { zoom };
const get = vi.fn((name: string) => (name === "canvas" ? canvas : undefined));

vi.mock("bpmn-js/lib/NavigatedViewer", () => ({
  default: class MockViewer {
    constructor(opts: unknown) {
      ctor(opts);
    }
    importXML = importXML;
    get = get;
    destroy = destroy;
  },
}));

const XML_A = "<bpmn:a/>";
const XML_B = "<bpmn:b/>";

beforeEach(() => {
  ctor.mockClear();
  importXML.mockReset().mockResolvedValue({ warnings: [] });
  destroy.mockClear();
  zoom.mockReset().mockReturnValue(1);
  get.mockClear();
});

describe("<BpmnViewer>", () => {
  it("creates a NavigatedViewer with a container element on mount", async () => {
    render(<BpmnViewer xml={XML_A} />);
    await waitFor(() => expect(ctor).toHaveBeenCalledTimes(1));
    const opts = ctor.mock.calls[0]![0] as { container: unknown };
    expect(opts.container).toBeInstanceOf(HTMLElement);
  });

  it("imports the xml and fits the viewport, then calls onImport", async () => {
    const onImport = vi.fn();
    render(<BpmnViewer xml={XML_A} onImport={onImport} />);
    await waitFor(() => expect(importXML).toHaveBeenCalledWith(XML_A));
    await waitFor(() => expect(onImport).toHaveBeenCalledWith({ warnings: [] }));
    expect(zoom).toHaveBeenCalledWith("fit-viewport");
  });

  it("toggles onLoadingChange true then false", async () => {
    const onLoadingChange = vi.fn();
    render(<BpmnViewer xml={XML_A} onLoadingChange={onLoadingChange} />);
    await waitFor(() => expect(onLoadingChange).toHaveBeenCalledWith(false));
    expect(onLoadingChange.mock.calls[0]![0]).toBe(true);
  });

  it("calls onError when importXML rejects", async () => {
    importXML.mockRejectedValueOnce(new Error("bad xml"));
    const onError = vi.fn();
    render(<BpmnViewer xml={XML_A} onError={onError} />);
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onError.mock.calls[0]![0]).toMatchObject({ message: "bad xml" });
  });

  it("re-imports when xml prop changes", async () => {
    const { rerender } = render(<BpmnViewer xml={XML_A} />);
    await waitFor(() => expect(importXML).toHaveBeenCalledWith(XML_A));
    rerender(<BpmnViewer xml={XML_B} />);
    await waitFor(() => expect(importXML).toHaveBeenCalledWith(XML_B));
  });

  it("destroys the viewer on unmount", async () => {
    const { unmount } = render(<BpmnViewer xml={XML_A} />);
    await waitFor(() => expect(ctor).toHaveBeenCalledTimes(1));
    unmount();
    await waitFor(() => expect(destroy).toHaveBeenCalledTimes(1));
  });

  it("exposes imperative zoom handle methods", async () => {
    const ref = createRef<BpmnViewerHandle>();
    render(<BpmnViewer xml={XML_A} ref={ref} />);
    await waitFor(() => expect(ctor).toHaveBeenCalledTimes(1));
    ref.current!.fitViewport();
    expect(zoom).toHaveBeenCalledWith("fit-viewport");
    zoom.mockReturnValue(1);
    ref.current!.zoomIn();
    // zoomIn → zoom(current * ZOOM_FACTOR) = zoom(1.2)
    expect(zoom).toHaveBeenCalledWith(expect.closeTo(1.2, 5));
    expect(ref.current!.getZoom()).toBe(1);
  });

  it("ignores a stale import result when a newer import supersedes it", async () => {
    // 第一次 import 延遲解析,第二次先解析 → 只有第二次的 onImport 生效。
    let resolveFirst!: (v: { warnings: unknown[] }) => void;
    importXML
      .mockImplementationOnce(() => new Promise((res) => (resolveFirst = res)))
      .mockResolvedValueOnce({ warnings: ["second"] });
    const onImport = vi.fn();
    const { rerender } = render(<BpmnViewer xml={XML_A} onImport={onImport} />);
    await waitFor(() => expect(importXML).toHaveBeenCalledTimes(1));
    rerender(<BpmnViewer xml={XML_B} onImport={onImport} />);
    await waitFor(() => expect(onImport).toHaveBeenCalledWith({ warnings: ["second"] }));
    // 現在才解析第一次(過期)—— 不應再觸發 onImport。
    resolveFirst({ warnings: ["first"] });
    await new Promise((r) => setTimeout(r, 0));
    expect(onImport).toHaveBeenCalledTimes(1);
    expect(onImport).not.toHaveBeenCalledWith({ warnings: ["first"] });
  });
});
