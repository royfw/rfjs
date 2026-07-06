import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@xyflow/react", () => ({
  Handle: () => null,
  Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
}));

import { messages } from "./messages";
import { nodeTypes } from "./nodes";

function renderNode(type: keyof typeof nodeTypes, data: Record<string, unknown>, locale: "en" | "zh-TW" = "en") {
  const Cmp = nodeTypes[type] as React.ComponentType<{ id: string; data: unknown }>;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages[locale] as Record<string, unknown>}>
      <Cmp id="n1" data={data} />
    </NextIntlClientProvider>,
  );
}

describe("flow node components", () => {
  it("form node shows its label and field count", () => {
    renderNode("form", { type: "form", config: { version: 1, fields: [{ key: "a" }, { key: "b" }] } });
    expect(screen.getByText(/form/i)).toBeTruthy();
    expect(screen.getByText(/2 fields/i)).toBeTruthy();
  });

  it("action node shows its kind", () => {
    renderNode("action", { type: "action", config: { kind: "notify", params: {} } });
    expect(screen.getByText(/kind: notify/i)).toBeTruthy();
  });

  it("condition node renders its label", () => {
    renderNode("condition", { type: "condition" });
    expect(screen.getByText(/condition/i)).toBeTruthy();
  });

  it("labels are localized (zh-TW)", () => {
    renderNode("form", { type: "form", config: { version: 1, fields: [{ key: "a" }] } }, "zh-TW");
    expect(screen.getByText("表單")).toBeTruthy();
    expect(screen.getByText(/1 個欄位/)).toBeTruthy();
  });
});
