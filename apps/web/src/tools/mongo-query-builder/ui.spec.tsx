import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import { messages } from "./messages";
import { MongoQueryBuilder } from "./ui";

describe("MongoQueryBuilder", () => {
  it("renders the builder and the compiled-query panel", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages.en as Record<string, unknown>}>
        <MongoQueryBuilder />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("Fields")).toBeTruthy();
    expect(screen.getAllByText("Compiled query").length).toBeGreaterThan(0);
  });
});
