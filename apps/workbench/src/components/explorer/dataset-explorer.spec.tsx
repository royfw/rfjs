import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/datasets", () => ({
  queryDatasets: vi.fn().mockResolvedValue({
    ok: true,
    result: {
      items: [
        {
          id: "1",
          name: "Alpha",
          description: null,
          data: {},
          createdAt: "2026-01-01",
          updatedAt: "2026-01-01",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    },
  }),
}));

import { queryDatasets } from "@/lib/datasets";
import { DatasetExplorer, type ExplorerLabels } from "./dataset-explorer";

afterEach(cleanup);

const labels: ExplorerLabels = {
  title: "Dataset Explorer",
  description: "d",
  run: "Run",
  empty: "none",
  error: "err",
  tree: {
    logic: { and: "AND", or: "OR", nor: "NOR", not: "NOT" },
    addCondition: "+c",
    addGroup: "+g",
    removeGroup: "rg",
    removeCondition: "rc",
    elemMatch: "em",
  },
};

describe("DatasetExplorer", () => {
  it("runs a query and renders matched datasets", async () => {
    render(<DatasetExplorer labels={labels} />);
    fireEvent.click(screen.getByText("Run"));
    await waitFor(() => expect(queryDatasets).toHaveBeenCalled());
    expect(await screen.findByText("Alpha")).toBeTruthy();
  });
});
