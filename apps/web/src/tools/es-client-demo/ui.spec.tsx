import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import { assembleMessages } from "@/i18n/messages";
import { EsClientDemo } from "./ui";

describe("EsClientDemo", () => {
  it("renders the builder, search-body panel, and scenario tabs", () => {
    render(
      <NextIntlClientProvider locale="en" messages={assembleMessages("en")}>
        <EsClientDemo />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("Fields")).toBeTruthy();
    expect(screen.getByText("Search body")).toBeTruthy();
    expect(screen.getAllByText("paginate").length).toBeGreaterThan(0);
  });

  it("renders the collapsible ToolIntro", () => {
    render(
      <NextIntlClientProvider locale="en" messages={assembleMessages("en")}>
        <EsClientDemo />
      </NextIntlClientProvider>,
    );
    expect(
      screen.getByRole("button", { name: /how does this tool work/i }),
    ).toBeTruthy();
  });
});
