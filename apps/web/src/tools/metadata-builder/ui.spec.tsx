import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { messages } from "./messages";

const mockRun = vi.fn();
const mockCancel = vi.fn();

vi.mock("@rfjs/ai-assist-ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@rfjs/ai-assist-ui")>()),
  useAiAssist: () => ({
    ready: true,
    loading: false,
    error: null,
    cancel: mockCancel,
    run: mockRun,
    runStream: mockRun,
    streamText: "",
    streamReasoning: "",
  }),
}));

import { MetadataBuilderTool } from "./ui";
import { assembleMessages } from "@/i18n/messages";

function renderTool() {
  return render(
    <NextIntlClientProvider locale="en" messages={assembleMessages("en")}>
      <MetadataBuilderTool />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  mockRun.mockReset();
});

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

  it("mount never writes the default sample over a stored meta (no transient clobber)", () => {
    localStorage.setItem(
      "rfjs.metadata-builder.meta",
      JSON.stringify({ fields: [{ key: "customField", label: "Custom", dataType: "string" }] }),
    );
    const spy = vi.spyOn(Storage.prototype, "setItem");
    renderTool();
    // the persist effect's mount run used to fire with the pre-restore DEFAULT_META
    // before the restore setMeta landed — that write must not happen.
    const clobber = spy.mock.calls.find(([key, value]) => {
      if (key !== "rfjs.metadata-builder.meta") return false;
      const parsed = JSON.parse(value as string) as { fields: { key: string }[] };
      return parsed.fields[0]?.key !== "customField";
    });
    expect(clobber).toBeUndefined();
    spy.mockRestore();
  });
});

describe("studio layout", () => {
  it("selecting a field switches the code panel to fragment mode; deselect via remove shows full json", () => {
    renderTool();

    fireEvent.click(screen.getByRole("option", { name: /price/ }));
    expect(screen.getByTestId("meta-json").textContent).not.toContain('"request"'); // 片段模式
    expect(screen.getByTestId("meta-json").textContent).toContain('"key": "price"');

    fireEvent.click(screen.getByRole("button", { name: "show all" }));
    expect(screen.getByTestId("meta-json").textContent).toContain('"request"');
  });

  it("collapse hides the code panel and persists; expand restores it", () => {
    renderTool();

    fireEvent.click(screen.getByRole("button", { name: "collapse code panel" }));
    expect(screen.queryByTestId("meta-json")).toBeNull();
    expect(localStorage.getItem("rfjs.metadata-builder.code-open")).toBe("0");

    fireEvent.click(screen.getByRole("button", { name: "expand code panel" }));
    expect(screen.getByTestId("meta-json")).toBeTruthy();
    expect(localStorage.getItem("rfjs.metadata-builder.code-open")).toBe("1");
  });

  it("the code panel stays mounted across editor tabs", () => {
    renderTool();
    fireEvent.click(screen.getByRole("button", { name: "Protocol" }));
    expect(screen.getByTestId("meta-json")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    expect(screen.getByTestId("meta-json")).toBeTruthy();
  });
});

describe("MetadataBuilderTool AI panel", () => {
  it("generate applies the returned meta through the import path and lands on Fields", async () => {
    const generated = { fields: [{ key: "order", label: "Order", dataType: "string" }] };
    mockRun.mockResolvedValue(JSON.stringify(generated, null, 2));
    renderTool();

    // 先切去 Protocol,證明 generate 會帶回 Fields 頁籤(import 語義)
    fireEvent.click(screen.getByRole("button", { name: "Protocol" }));

    fireEvent.change(screen.getByPlaceholderText("Describe a resource or ask a question…"), {
      target: { value: "an order resource" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate meta" }));

    // 整份取代:新欄位出現在清單、舊 request 不在預覽 JSON、回到 Fields 頁籤
    expect(await screen.findByRole("option", { name: /order/ })).toBeTruthy();
    expect(screen.getByTestId("meta-json").textContent).not.toContain('"request"');
    await screen.findByText("Applied (1 fields)");
  });

  it("ask records a plain answer entry", async () => {
    mockRun.mockResolvedValue("It declares a single product resource.");
    renderTool();

    fireEvent.change(screen.getByPlaceholderText("Describe a resource or ask a question…"), {
      target: { value: "what is this?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));

    await screen.findByText("It declares a single product resource.");
  });

  it("renders the collapsible ToolIntro and expands to the concepts", () => {
    renderTool();
    const header = screen.getByRole("button", { name: /how does this tool work/i });
    expect(screen.queryByText("Field kinds, data types, enum domains, filterability.")).toBeNull();
    fireEvent.click(header);
    expect(screen.getByText("Field kinds, data types, enum domains, filterability.")).toBeTruthy();
  });
});
