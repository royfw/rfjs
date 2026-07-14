import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import { assembleMessages } from "@/i18n/messages";
import { MongoQueryGenerator } from "./ui";

describe("MongoQueryGenerator", () => {
  it("renders the collapsible ToolIntro", () => {
    render(
      <NextIntlClientProvider locale="en" messages={assembleMessages("en")}>
        <MongoQueryGenerator />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("button", { name: /how does this tool work/i })).toBeTruthy();
    expect(screen.getByText("FILTER → MONGO QUERY")).toBeTruthy();
  });
});
