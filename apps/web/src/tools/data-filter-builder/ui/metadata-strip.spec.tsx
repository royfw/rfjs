import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { FieldSchema } from "@rfjs/filter-builder";

import { MetadataStrip } from "./metadata-strip";

const schema: FieldSchema[] = [{ path: "age", dataType: "numeric", include: true, kind: "jsonb" }];

const labels = { include: "include", type: "type" };

describe("MetadataStrip", () => {
  it("renders a chip per field", () => {
    render(<MetadataStrip schema={schema} onChange={vi.fn()} labels={labels} />);
    expect(screen.getByText("age")).toBeDefined();
  });

  it("toggles include via onChange", () => {
    const onChange = vi.fn();
    render(<MetadataStrip schema={schema} onChange={onChange} labels={labels} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "include age" }));
    expect(onChange).toHaveBeenCalledWith([{ ...schema[0], include: false }]);
  });
});
