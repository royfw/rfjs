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
        payload={{ data: { name: "filled" }, meta }}
      />,
    );
    expect(screen.getByText(/Required/)).toBeDefined();
  });

  it("renders empty-state when payload is null", () => {
    render(<SubmissionPanel payload={null} />);
    expect(screen.getByText(/fill the form/i)).toBeDefined();
  });

  it("translates 'Expected string, received undefined' error to 'Required' when errors are shown", () => {
    // name is filled (form has data) → errors list is shown → "Required" should appear
    const meta: SubmissionMeta = {
      valid: false,
      errors: { email: "Expected string, received undefined" },
      visibleKeys: ["name", "email"],
    };
    render(
      <SubmissionPanel
        payload={{ data: { name: "Ann", email: undefined }, meta }}
      />,
    );
    // Should NOT show the raw zod message
    expect(screen.queryByText(/Expected string, received undefined/)).toBeNull();
    // Should show the friendly label instead
    expect(screen.getByText(/Required/)).toBeDefined();
  });

  it("shows calm Incomplete state when valid=false and all data values are empty/undefined", () => {
    const meta: SubmissionMeta = {
      valid: false,
      errors: { name: "Expected string, received undefined", email: "Expected string, received undefined" },
      visibleKeys: [],
    };
    render(
      <SubmissionPanel
        payload={{ data: {}, meta }}
      />,
    );
    // Should show the amber Incomplete message, not red "Invalid"
    expect(screen.getByText(/incomplete/i)).toBeDefined();
    // Should include the count of required fields (2)
    expect(screen.getByText(/2 required field/i)).toBeDefined();
    // Should NOT show "Invalid"
    expect(screen.queryByText(/^Invalid$/i)).toBeNull();
  });

  it("shows red Invalid badge when valid=false but form has actual data", () => {
    const meta: SubmissionMeta = {
      valid: false,
      errors: { email: "Invalid email format" },
      visibleKeys: ["name", "email"],
    };
    render(
      <SubmissionPanel
        payload={{ data: { name: "Ann", email: "not-an-email" }, meta }}
      />,
    );
    // Has real data → real validation failure → show Invalid
    expect(screen.getByText("Invalid")).toBeDefined();
    // Friendly error message shown
    expect(screen.getByText(/Invalid email format/)).toBeDefined();
  });

  it('shows the firing action and apiError when present', () => {
    render(
      <SubmissionPanel
        payload={{
          data: { a: 1 },
          meta: { valid: true, errors: {}, visibleKeys: ['a'], schemaVersion: 1, timestamp: 't', action: { type: 'custom', name: 'save-draft' }, apiError: 'boom' },
        }}
      />,
    );
    expect(screen.getByText(/custom/)).toBeTruthy();
    expect(screen.getByText(/save-draft/)).toBeTruthy();
    expect(screen.getByText(/boom/)).toBeTruthy();
  });
});
