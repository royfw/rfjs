import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SubmissionPanel } from "./submission-panel";
import type { SubmissionMeta } from "@rfjs/form-builder-ui";

describe("SubmissionPanel", () => {
  it("renders data and meta; shows valid state", () => {
    const meta: SubmissionMeta = { valid: true, errors: {}, visibleKeys: ["name"] };
    render(
      <SubmissionPanel
        payload={{ data: { name: "Ann" }, meta }}
      />,
    );
    expect(screen.getByText(/"name": "Ann"/)).toBeDefined();
    expect(screen.getByText(/valid/i)).toBeDefined();
  });

  it("shows invalid + errors", () => {
    const meta: SubmissionMeta = { valid: false, errors: { name: "Required" }, visibleKeys: [] };
    render(
      <SubmissionPanel
        payload={{ data: {}, meta }}
      />,
    );
    expect(screen.getByText(/Required/)).toBeDefined();
  });

  it("renders empty-state when payload is null", () => {
    render(<SubmissionPanel payload={null} />);
    expect(screen.getByText(/fill the form/i)).toBeDefined();
  });
});
