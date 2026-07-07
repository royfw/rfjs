import { describe, expect, it } from "vitest";

import { runMongoQuery } from "./mongo-query-generator";

const META =
  '{"logic":"and","filters":[{"field":"name","condition":"eq","dataType":"string","value":"Ada"}]}';

describe("runMongoQuery", () => {
  it("generates a MongoDB query document", () => {
    expect(runMongoQuery(META)).toEqual({
      ok: true,
      output:
        '{\n  "$and": [\n    {\n      "name": {\n        "$eq": "Ada"\n      }\n    }\n  ]\n}',
    });
  });
  it("rejects invalid JSON", () => {
    expect(runMongoQuery("nope")).toEqual({ ok: false, error: "invalidJson" });
  });
  it("reports a generation failure as queryFailed", () => {
    expect(runMongoQuery('{"logic":"and"}')).toEqual({
      ok: false,
      error: "queryFailed",
    });
  });
});
