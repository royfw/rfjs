import { describe, expect, it } from "vitest";

import { assembleMessages, deepMerge } from "./messages";
import en from "../messages/en.json";
import zhTW from "../messages/zh-TW.json";

describe("deepMerge", () => {
  it("recursively merges nested objects, override wins on leaves", () => {
    const base = { a: { x: 1, y: 2 }, b: 1 };
    const out = deepMerge(base, { a: { y: 9, z: 3 } });
    expect(out).toEqual({ a: { x: 1, y: 9, z: 3 }, b: 1 });
  });

  it("does not mutate the base object", () => {
    const base = { a: { x: 1 } };
    deepMerge(base, { a: { x: 2 } });
    expect(base).toEqual({ a: { x: 1 } });
  });
});

describe("assembleMessages", () => {
  // Tool fragments only ADD to the central catalog (each migrated tool moves its
  // keys out of the central json and back in via a fragment), so the central
  // catalog is always a subset of the assembled result — at every migration step.
  it("preserves every central catalog key", () => {
    expect(assembleMessages("en")).toMatchObject(en);
    expect(assembleMessages("zh-TW")).toMatchObject(zhTW);
  });
});
