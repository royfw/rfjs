import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import { assembleMessages } from "@/i18n/messages";
import { JwtDecoder } from "./ui";

describe("JwtDecoder", () => {
  it("renders the collapsible ToolIntro", () => {
    render(
      <NextIntlClientProvider locale="en" messages={assembleMessages("en")}>
        <JwtDecoder />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("button", { name: /how does this tool work/i })).toBeTruthy();
  });
});
