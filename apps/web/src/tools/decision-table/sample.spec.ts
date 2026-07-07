import { describe, expect, it } from "vitest";
import { decisionTableSchema, evaluateTable } from "@rfjs/decision-table";

import { sampleTable, sampleBatch } from "./sample";

describe("decision-table sample", () => {
  it("is schema-valid and routes a big amount to the CFO", async () => {
    expect(() => decisionTableSchema.parse(sampleTable)).not.toThrow();
    const r = await evaluateTable(sampleTable, { amount: 200000, dept: "Engineering" });
    expect(r.matched.length).toBeGreaterThan(0);
    expect((r.outputs as Record<string, unknown>).approver).toBe("CFO");
    expect(r.ruleErrors).toEqual([]);
  });

  it("falls back to defaultOutputs for a small unmatched request", async () => {
    const r = await evaluateTable(sampleTable, { amount: 100, dept: "HR" });
    expect(r.usedDefault).toBe(true);
  });

  it("ships a batch of at least 4 sample contexts", () => {
    expect(sampleBatch.length).toBeGreaterThanOrEqual(4);
    for (const row of sampleBatch) expect(typeof row).toBe("object");
  });
});
