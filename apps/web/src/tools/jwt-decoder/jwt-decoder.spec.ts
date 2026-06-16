import { describe, it, expect } from "vitest";

import { describeExp, formatDuration } from "./jwt-decoder";

describe("describeExp", () => {
  it("reports valid with seconds left when exp is in the future", () => {
    expect(describeExp(1000, 400)).toEqual({ state: "valid", secondsLeft: 600 });
  });
  it("reports expired when exp is in the past", () => {
    expect(describeExp(400, 1000)).toEqual({ state: "expired", secondsLeft: -600 });
  });
  it("reports none when there is no exp", () => {
    expect(describeExp(undefined, 1000)).toEqual({ state: "none" });
  });
});

describe("formatDuration", () => {
  it("formats hours, minutes and seconds, dropping empty leading units", () => {
    expect(formatDuration(3661)).toBe("1h 1m 1s");
    expect(formatDuration(65)).toBe("1m 5s");
    expect(formatDuration(9)).toBe("9s");
  });
  it("uses the magnitude regardless of sign", () => {
    expect(formatDuration(-65)).toBe("1m 5s");
  });
});
