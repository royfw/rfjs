import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it } from "vitest";

import { messages } from "./messages";
import { MetadataBuilderTool } from "./ui";

function renderTool() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages.en as Record<string, unknown>}>
      <MetadataBuilderTool />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => localStorage.clear());

describe("messages parity", () => {
  // 既有 i18n 閘(src/i18n/messages.spec.ts)只保護中央目錄;工具片段的 en/zh-TW 不對稱沒人抓 —— 自己守。
  it("en and zh-TW fragments declare identical key sets", () => {
    const en = messages.en as Record<string, Record<string, unknown>>;
    const zh = messages["zh-TW"] as Record<string, Record<string, unknown>>;
    expect(Object.keys(zh.ToolUI!).sort()).toEqual(Object.keys(en.ToolUI!).sort());
    expect(Object.keys(zh.Tools!).sort()).toEqual(Object.keys(en.Tools!).sort());
  });
});

describe("MetadataBuilderTool", () => {
  it("tabs swap the editor panel while the derived preview stays visible", () => {
    renderTool();

    expect(screen.getByRole("button", { name: "+ field" })).toBeTruthy(); // default Fields
    fireEvent.click(screen.getByRole("button", { name: "Protocol" }));
    expect(screen.queryByRole("button", { name: "+ field" })).toBeNull();
    expect(screen.getByTestId("meta-json")).toBeTruthy(); // preview always on
  });

  it("editing a field key reflects into the preview json", () => {
    renderTool();

    fireEvent.click(screen.getByRole("option", { name: /price/ }));
    fireEvent.change(screen.getByLabelText("key"), { target: { value: "cost" } });

    expect(screen.getByTestId("meta-json").textContent).toContain('"key": "cost"');
    // 注意用完整 "key": 前綴 —— label 仍是 "Price"(大寫),裸 "price" 斷言只靠大小寫僥倖通過
    expect(screen.getByTestId("meta-json").textContent).not.toContain('"key": "price"');
  });

  it("meta.json import replaces the whole meta", () => {
    renderTool();

    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    fireEvent.change(screen.getByPlaceholderText("paste meta json…"), {
      target: { value: '{"fields":[{"key":"only","label":"Only","dataType":"string"}]}' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Load" }));

    const json = screen.getByTestId("meta-json").textContent!;
    expect(json).toContain('"only"');
    expect(json).not.toContain('"request"'); // 整份取代,舊 request 不留
  });

  it("rows import replaces fields but keeps the protocol", () => {
    renderTool();

    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    fireEvent.click(screen.getByRole("button", { name: "sample rows" }));
    fireEvent.change(screen.getByPlaceholderText("paste rows json…"), {
      target: { value: '[{"sku":"x1"}]' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Load" }));

    const json = screen.getByTestId("meta-json").textContent!;
    expect(json).toContain('"sku"');
    expect(json).toContain('"request"'); // 協定保留
  });

  it("persists edits to localStorage and restores them on remount", () => {
    const { unmount } = renderTool();
    fireEvent.click(screen.getByRole("option", { name: /price/ }));
    fireEvent.change(screen.getByLabelText("key"), { target: { value: "cost" } });
    unmount();

    renderTool();
    expect(screen.getByTestId("meta-json").textContent).toContain('"cost"');
  });

  it("silently falls back to the default sample when localStorage holds garbage", () => {
    localStorage.setItem("rfjs.metadata-builder.meta", "{broken");
    renderTool();
    expect(screen.getByTestId("meta-json").textContent).toContain('"price"');
  });
});
