import { renderHook, act } from "@testing-library/react";
import * as React from "react";
import { useContainerBreakpoint } from "./use-container-breakpoint";

// Controllable ResizeObserver mock: captures the callback so the test can fire
// width changes manually. Overrides the no-op stub from vitest.setup.ts.
let cb: (e: any[]) => void;
beforeEach(() => {
  cb = () => {};
  (globalThis as any).ResizeObserver = class {
    constructor(c: any) {
      cb = c;
    }
    observe() {}
    disconnect() {}
  };
});

it("starts false (SSR-safe) and flips when width < breakpoint", () => {
  const ref = { current: document.createElement("div") } as React.RefObject<HTMLElement>;
  const { result } = renderHook(() => useContainerBreakpoint(ref, 640));
  expect(result.current).toBe(false);
  act(() => cb([{ contentRect: { width: 500 } }]));
  expect(result.current).toBe(true);
  act(() => cb([{ contentRect: { width: 800 } }]));
  expect(result.current).toBe(false);
});
