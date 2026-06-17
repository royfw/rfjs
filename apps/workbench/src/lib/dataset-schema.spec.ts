import { describe, expect, it } from "vitest";

import { DATASET_FIELD_SCHEMA } from "./dataset-schema";

describe("DATASET_FIELD_SCHEMA", () => {
  it("exposes the queryable column fields aligned to datasetPgConfig", () => {
    const byPath = Object.fromEntries(DATASET_FIELD_SCHEMA.map((f) => [f.path, f]));
    expect(byPath.name).toMatchObject({ kind: "column", dataType: "string" });
    expect(byPath.description).toMatchObject({ kind: "column", dataType: "string" });
    expect(byPath.createdAt).toMatchObject({ kind: "column", dataType: "date" });
    expect(byPath.updatedAt).toMatchObject({ kind: "column", dataType: "date" });
  });

  it("marks every field included so it shows in the builder", () => {
    expect(DATASET_FIELD_SCHEMA.every((f) => f.include)).toBe(true);
  });
});
