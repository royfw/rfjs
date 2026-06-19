import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import { messages } from "./messages";
import { SqlFilterBuilder } from "./ui";

describe("SqlFilterBuilder", () => {
  it("renders the builder and the compiled-query panel", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages.en as Record<string, unknown>}>
        <SqlFilterBuilder />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("Fields")).toBeTruthy();
    expect(screen.getAllByText("Compiled query").length).toBeGreaterThan(0);
  });
});
