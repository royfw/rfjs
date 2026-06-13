import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CopyButton } from "./copy-button";

describe("CopyButton", () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  it("writes the given text to the clipboard on click", async () => {
    const { container } = render(<CopyButton text="hello" label="Copy SQL" />);
    container.querySelector("button")!.click();
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith("hello"));
  });

  it("shows a copied state after clicking", async () => {
    const { container } = render(<CopyButton text="hello" label="Copy SQL" />);
    container.querySelector("button")!.click();
    await waitFor(() => expect(screen.getByText(/copied/i)).toBeDefined());
  });
});
