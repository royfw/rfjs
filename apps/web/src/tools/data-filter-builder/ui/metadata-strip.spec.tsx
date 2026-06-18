import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { FieldSchema } from "@rfjs/filter-builder";

import { MetadataStrip } from "./metadata-strip";

const schema: FieldSchema[] = [{ path: "age", dataType: "numeric", include: true, kind: "jsonb" }];

const labels = { fields: "Fields", infer: "infer", include: "include", type: "type" };

describe("MetadataStrip", () => {
  it("renders a chip per field", () => {
    render(<MetadataStrip schema={schema} onChange={vi.fn()} onInfer={vi.fn()} labels={labels} />);
    expect(screen.getByText("age")).toBeDefined();
  });

  it("invokes onInfer", () => {
    const onInfer = vi.fn();
    render(<MetadataStrip schema={schema} onChange={vi.fn()} onInfer={onInfer} labels={labels} />);
    fireEvent.click(screen.getByText("infer"));
    expect(onInfer).toHaveBeenCalled();
  });

  it("toggles include via onChange", () => {
    const onChange = vi.fn();
    render(<MetadataStrip schema={schema} onChange={onChange} onInfer={vi.fn()} labels={labels} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "include age" }));
    expect(onChange).toHaveBeenCalledWith([{ ...schema[0], include: false }]);
  });
});
