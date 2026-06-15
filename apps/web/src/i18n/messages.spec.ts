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
  it("with no tool fragments equals the central catalog", () => {
    expect(assembleMessages("en")).toEqual(en);
    expect(assembleMessages("zh-TW")).toEqual(zhTW);
  });
});
