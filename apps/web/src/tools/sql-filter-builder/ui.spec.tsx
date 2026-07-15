import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import { assembleMessages } from "@/i18n/messages";
import { SqlFilterBuilder } from "./ui";

describe("SqlFilterBuilder", () => {
  it("renders the builder and the compiled-query panel", () => {
    render(
      <NextIntlClientProvider locale="en" messages={assembleMessages("en")}>
        <SqlFilterBuilder />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("Fields")).toBeTruthy();
    expect(screen.getAllByText("Compiled query").length).toBeGreaterThan(0);
  });

  it("renders the collapsible ToolIntro", () => {
    render(
      <NextIntlClientProvider locale="en" messages={assembleMessages("en")}>
        <SqlFilterBuilder />
      </NextIntlClientProvider>,
    );
    expect(
      screen.getByRole("button", { name: /how does this tool work/i }),
    ).toBeTruthy();
  });
});
