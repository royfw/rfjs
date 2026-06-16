import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CanonicalEditor } from "./canonical-editor";

afterEach(cleanup);

describe("CanonicalEditor", () => {
  it("calls onParse with the edited text after the debounce window", () => {
    vi.useFakeTimers();
    const onParse = vi.fn();
    render(<CanonicalEditor serialized="{}" errorText={null} hint="edit" onParse={onParse} />);
    const ta = screen.getByLabelText("edit") as HTMLTextAreaElement;
    fireEvent.focus(ta);
    fireEvent.change(ta, { target: { value: '{"logic":"and","filters":[]}' } });
    expect(onParse).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(onParse).toHaveBeenCalledWith('{"logic":"and","filters":[]}');
    vi.useRealTimers();
  });

  it("does not overwrite the draft from serialized while the box is focused", () => {
    const { rerender } = render(<CanonicalEditor serialized="A" errorText={null} hint="edit" onParse={() => {}} />);
    const ta = screen.getByLabelText("edit") as HTMLTextAreaElement;
    fireEvent.focus(ta);
    fireEvent.change(ta, { target: { value: "B" } });
    rerender(<CanonicalEditor serialized="C" errorText={null} hint="edit" onParse={() => {}} />);
    expect(ta.value).toBe("B");
  });

  it("re-syncs the draft from serialized when not editing", () => {
    const { rerender } = render(<CanonicalEditor serialized="A" errorText={null} hint="edit" onParse={() => {}} />);
    const ta = screen.getByLabelText("edit") as HTMLTextAreaElement;
    rerender(<CanonicalEditor serialized="C" errorText={null} hint="edit" onParse={() => {}} />);
    expect(ta.value).toBe("C");
  });

  it("shows errorText when present", () => {
    render(<CanonicalEditor serialized="{}" errorText="bad shape" hint="edit" onParse={() => {}} />);
    expect(screen.getByText("bad shape")).toBeTruthy();
  });
});
