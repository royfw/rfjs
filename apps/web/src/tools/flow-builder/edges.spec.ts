import { describe, expect, it } from "vitest";

import { adaptivePath, SNAP_EPS } from "./edges";

describe("adaptivePath", () => {
  it("snaps to a straight line when endpoints are nearly horizontal", () => {
    const r = adaptivePath({ sourceX: 0, sourceY: 100, targetX: 200, targetY: 100 + SNAP_EPS });
    expect(r.straight).toBe(true);
    expect(r.path).not.toContain("C"); // no bezier curve command
  });

  it("snaps when endpoints are nearly vertical", () => {
    const r = adaptivePath({ sourceX: 100, sourceY: 0, targetX: 100 - SNAP_EPS, targetY: 200 });
    expect(r.straight).toBe(true);
  });

  it("curves when the offset exceeds the snap epsilon", () => {
    const r = adaptivePath({ sourceX: 0, sourceY: 100, targetX: 200, targetY: 100 + SNAP_EPS + 40 });
    expect(r.straight).toBe(false);
    expect(r.path).toContain("C"); // bezier
  });
});
