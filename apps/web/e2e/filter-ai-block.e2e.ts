import { test, expect } from "@playwright/test";

test("ai assist block lives in the filter logic section", async ({ page }) => {
  await page.goto("/en/tools/pg-filter-builder");
  const input = page.getByPlaceholder(/describe a filter or ask a question/i);
  await expect(input).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: /explain current filter/i })).toBeVisible();
});

test("unconfigured ai leaves the three actions disabled with guidance", async ({ page }) => {
  await page.goto("/en/tools/data-filter-builder");
  await expect(page.getByRole("button", { name: /explain current filter/i })).toBeDisabled({ timeout: 15_000 });
  await expect(page.getByText(/set up an ai connection first/i)).toBeVisible();
});
