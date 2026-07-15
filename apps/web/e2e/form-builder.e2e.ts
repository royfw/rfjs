import { test, expect } from "@playwright/test";

const URL = "/en/tools/form-builder";

test("preview: custom action button surfaces its payload in the submission panel", async ({ page }) => {
  await page.goto(URL);
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await page.getByRole("button", { name: /save draft/i }).click();
  await expect(page.getByText(/save-draft/).first()).toBeVisible({ timeout: 15_000 });
});

test("preview: query api button renders the echoed response in the result card", async ({ page }) => {
  await page.goto(URL);
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await page.getByRole("button", { name: /^query$/i }).click();
  await expect(page.locator('[data-item="res_query"]')).toContainText("name", { timeout: 15_000 });
});
