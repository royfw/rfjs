import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import { messages } from "./messages";
import { PgFilterBuilder } from "./ui";

describe("PgFilterBuilder", () => {
  it("renders the builder, the kind toggles, and the compiled-query panel", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages.en as Record<string, unknown>}>
        <PgFilterBuilder />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("Fields")).toBeTruthy();
    expect(screen.getAllByText("Compiled query").length).toBeGreaterThan(0);
    // top-level scalar fields default to the `column` target
    expect(screen.getByRole("button", { name: "target name" }).textContent).toBe("col");
  });
});
