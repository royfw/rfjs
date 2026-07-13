import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import { assembleMessages } from "@/i18n/messages";
import { JsonbQueryGenerator } from "./ui";

describe("JsonbQueryGenerator", () => {
  it("renders the collapsible ToolIntro", () => {
    render(
      <NextIntlClientProvider locale="en" messages={assembleMessages("en")}>
        <JsonbQueryGenerator />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("button", { name: /how does this tool work/i })).toBeTruthy();
  });
});
