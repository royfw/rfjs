import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import { assembleMessages } from "@/i18n/messages";
import { JsonbQueryBuilder } from "./ui";

describe("JsonbQueryBuilder", () => {
  it("renders the builder and the compiled-query panel", () => {
    render(
      <NextIntlClientProvider locale="en" messages={assembleMessages("en")}>
        <JsonbQueryBuilder />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("Fields")).toBeTruthy();
    expect(screen.getAllByText("Compiled query").length).toBeGreaterThan(0);
  });
});
