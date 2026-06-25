import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import { messages } from "./messages";
import { EsClientDemo } from "./ui";

describe("EsClientDemo", () => {
  it("renders the builder, search-body panel, and scenario tabs", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages.en as Record<string, unknown>}>
        <EsClientDemo />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("Fields")).toBeTruthy();
    expect(screen.getByText("Search body")).toBeTruthy();
    expect(screen.getAllByText("paginate").length).toBeGreaterThan(0);
  });
});
