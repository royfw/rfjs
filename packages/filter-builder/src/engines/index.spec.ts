import { describe, expect, it } from "vitest";

import { ENGINE_IDS, getEngine } from "./index";

describe("engine registry", () => {
  it("lists all engine ids, jsonb first", () => {
    expect(ENGINE_IDS).toEqual(["jsonb", "data-filter", "pg-filter"]);
  });

  it("resolves an engine by id", () => {
    expect(getEngine("jsonb").id).toBe("jsonb");
    expect(getEngine("data-filter").id).toBe("data-filter");
    expect(getEngine("pg-filter").id).toBe("pg-filter");
  });
});
