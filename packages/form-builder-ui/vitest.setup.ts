// jsdom does not implement ResizeObserver, which some Radix primitives
// instantiate on mount. Provide a no-op stub for the test env.
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

// jsdom defines getContext() but returns null (and logs "Not implemented"),
// which causes signature_pad's constructor to throw. Override unconditionally
// with a minimal 2d-context stub sufficient for the test env.
HTMLCanvasElement.prototype.getContext = (() => ({
  fillRect: () => {},
  clearRect: () => {},
  beginPath: () => {},
  moveTo: () => {},
  lineTo: () => {},
  stroke: () => {},
  fill: () => {},
  arc: () => {},
  closePath: () => {},
  save: () => {},
  restore: () => {},
  translate: () => {},
  scale: () => {},
  canvas: document.createElement('canvas'),
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  lineCap: 'round' as CanvasLineCap,
})) as unknown as typeof HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,stub';
