import { describe, expect, it } from "vitest";

import { ZOOM_FACTOR, MIN_ZOOM, MAX_ZOOM, clampZoom, zoomBy } from "./zoom";

describe("zoom helpers", () => {
  it("clamps below min and above max", () => {
    expect(clampZoom(MIN_ZOOM - 1)).toBe(MIN_ZOOM);
    expect(clampZoom(MAX_ZOOM + 1)).toBe(MAX_ZOOM);
    expect(clampZoom(1)).toBe(1);
  });

  it("zoomBy multiplies then clamps", () => {
    expect(zoomBy(1, ZOOM_FACTOR)).toBeCloseTo(ZOOM_FACTOR);
    expect(zoomBy(1, 1 / ZOOM_FACTOR)).toBeCloseTo(1 / ZOOM_FACTOR);
    expect(zoomBy(MAX_ZOOM, ZOOM_FACTOR)).toBe(MAX_ZOOM); // already at max
    expect(zoomBy(MIN_ZOOM, 1 / ZOOM_FACTOR)).toBe(MIN_ZOOM); // already at min
  });

  it("zoomOut never increases zoom below the floor; zoomIn still moves up", () => {
    expect(zoomBy(0.12, 1 / ZOOM_FACTOR)).toBeLessThanOrEqual(0.12);
    expect(zoomBy(0.12, ZOOM_FACTOR)).toBeGreaterThan(0.12);
  });
});
