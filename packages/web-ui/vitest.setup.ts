// jsdom does not implement ResizeObserver, which cmdk (Command) and some Radix
// primitives instantiate on mount. Provide a no-op stub for the test env.
globalThis.ResizeObserver ??= class {
  observe() {
    /* no-op in jsdom */
  }
  unobserve() {
    /* no-op in jsdom */
  }
  disconnect() {
    /* no-op in jsdom */
  }
} as unknown as typeof ResizeObserver;

// jsdom does not implement scrollIntoView, which cmdk calls to keep the active
// item in view.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {
    /* no-op in jsdom */
  };
}
