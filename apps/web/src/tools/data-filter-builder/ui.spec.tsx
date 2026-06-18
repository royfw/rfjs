import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import { messages } from "./messages";
import { DataFilterBuilder } from "./ui";

describe("DataFilterBuilder", () => {
  it("renders the builder over the default sample", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages.en as Record<string, unknown>}>
        <DataFilterBuilder />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("name")).toBeDefined();
  });

  it("shows the live matched counts", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages.en as Record<string, unknown>}>
        <DataFilterBuilder />
      </NextIntlClientProvider>,
    );
    // empty tree → matches everything (2 sample rows)
    expect(screen.getByText("raw 2 · matched 2")).toBeDefined();
  });
});
