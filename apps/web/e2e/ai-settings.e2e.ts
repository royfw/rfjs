import { test, expect } from "@playwright/test";

test("header sparkles opens the ai settings dialog", async ({ page }) => {
  await page.goto("/en/tools/decision-table");
  await page.getByRole("button", { name: /ai settings/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByLabel(/base url/i)).toBeVisible();
});

test("unconfigured ai leaves assist buttons disabled with guidance", async ({ page }) => {
  await page.goto("/en/tools/decision-table");
  const check = page.getByRole("button", { name: /ai check/i });
  await expect(check).toBeVisible({ timeout: 15_000 });
  await expect(check).toBeDisabled();
});
