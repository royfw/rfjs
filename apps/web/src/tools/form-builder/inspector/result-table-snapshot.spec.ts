import { describe, it, expect } from "vitest";
import { snapshotTableConfig } from "./result-table-snapshot";

describe("snapshotTableConfig", () => {
  it("derives a TableConfig from a sample array", () => {
    const { config, error } = snapshotTableConfig('[{"id":1,"name":"Ada"}]');
    expect(error).toBeUndefined();
    expect(config?.columns.map((c) => c.key)).toEqual(["id", "name"]);
    expect(config?.pagination.pageSize).toBeGreaterThan(0);
  });

  it("wraps a single object into a one-row inference", () => {
    const { config } = snapshotTableConfig('{"a":1,"b":"x"}');
    expect(config?.columns.map((c) => c.key)).toEqual(["a", "b"]);
  });

  it("returns an error for invalid JSON", () => {
    const { config, error } = snapshotTableConfig("{not json");
    expect(config).toBeUndefined();
    expect(error).toMatch(/json/i);
  });

  it("returns an error for an empty array", () => {
    const { error } = snapshotTableConfig("[]");
    expect(error).toBeTruthy();
  });
});
