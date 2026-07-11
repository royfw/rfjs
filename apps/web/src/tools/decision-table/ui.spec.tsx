if (typeof Element !== "undefined") {
  if (!Element.prototype.hasPointerCapture)
    Element.prototype.hasPointerCapture = () => false;
  if (!Element.prototype.setPointerCapture)
    Element.prototype.setPointerCapture = () => {};
  if (!Element.prototype.releasePointerCapture)
    Element.prototype.releasePointerCapture = () => {};
  if (!Element.prototype.scrollIntoView)
    Element.prototype.scrollIntoView = () => {};
}

import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@rfjs/filter-builder-ui", () => ({
  FilterTreeEditor: () => <div data-testid="fte" />,
}));

const mockRun = vi.fn();
const mockCancel = vi.fn();
let mockReady = true;
let mockLoading = false;
let mockError: { kind: string; message: string; detail?: string } | null = null;

vi.mock("@rfjs/ai-assist-ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@rfjs/ai-assist-ui")>()),
  useAiAssist: () => ({
    ready: mockReady,
    loading: mockLoading,
    error: mockError,
    cancel: mockCancel,
    run: mockRun,
    runStream: mockRun,
    streamText: "",
    streamReasoning: "",
  }),
}));

import { messages } from "./messages";
import { DecisionTableTool } from "./ui";

function renderTool() {
  return render(
    <NextIntlClientProvider
      locale="en"
      messages={messages.en as Record<string, unknown>}
    >
      <DecisionTableTool />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  mockRun.mockReset();
  mockCancel.mockReset();
  mockReady = true;
  mockLoading = false;
  mockError = null;
});

describe("DecisionTableTool", () => {
  it("renders the sample rules", () => {
    renderTool();
    const rulesList = screen.getByTestId("dt-rules-list");
    expect(
      within(rulesList).getByText(/big spend goes to the cfo/i),
    ).toBeTruthy();
    expect(within(rulesList).getByText(/finance requests/i)).toBeTruthy();
  });

  it("single evaluation shows the routed approver", async () => {
    renderTool();
    const ta = screen.getByLabelText(/context json/i) as HTMLTextAreaElement;
    fireEvent.change(ta, {
      target: { value: '{"amount": 200000, "dept": "Engineering"}' },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /^evaluate$/i })[0]!);
    await waitFor(() =>
      expect(screen.getAllByText(/cfo/i).length).toBeGreaterThan(0),
    );
  });

  it("batch evaluation renders one result row per context", async () => {
    renderTool();
    const ta = screen.getByLabelText(/rows json/i) as HTMLTextAreaElement;
    fireEvent.change(ta, {
      target: { value: '[{"amount":200000},{"amount":1,"dept":"HR"}]' },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /^evaluate$/i })[1]!);
    await waitFor(() => {
      expect(screen.getAllByTestId("dt-batch-row")).toHaveLength(2);
    });
  });

  it("opening a rule mounts the embedded FilterTreeEditor in a dialog", () => {
    renderTool();
    fireEvent.click(screen.getAllByRole("button", { name: /edit rule/i })[0]!);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByTestId("fte")).toBeTruthy();
  });

  it("json import rejects an invalid table", async () => {
    renderTool();
    const ta = screen.getByLabelText(/^import$/i) as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: '{"version": 2}' } });
    fireEvent.click(screen.getByRole("button", { name: /^import$/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  });
});

describe("DecisionTableTool — AI panel", () => {
  it("shows the shared AI panel and drops the old Rules-header Check button", () => {
    renderTool();
    expect(
      screen.getByPlaceholderText(/describe or ask a question/i),
    ).toBeTruthy();
    const header = screen.getByText(/^Rules$/).closest("div")!;
    expect(within(header).queryByRole("button", { name: /check/i })).toBeNull();
  });

  it("check succeeds → the answer stack shows the formatted finding", async () => {
    mockRun.mockImplementation((_req, parse) =>
      Promise.resolve(
        parse('{"findings":[{"kind":"gap","ruleIds":[],"message":"m"}]}'),
      ),
    );
    renderTool();
    fireEvent.click(screen.getByRole("button", { name: /^check table$/i }));
    await waitFor(() => expect(screen.getByText("[gap] m")).toBeTruthy());
  });
});
