import { test, expect } from "@playwright/test";

test("header sparkles opens the ai settings dialog", async ({ page }) => {
  await page.goto("/en/tools/decision-table");
  await page.getByRole("button", { name: /ai settings/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByLabel(/base url/i)).toBeVisible();
});

test("unconfigured ai leaves assist buttons disabled with guidance", async ({ page }) => {
  await page.goto("/en/tools/decision-table");
  const check = page.getByRole("button", { name: /check table/i });
  await expect(check).toBeVisible({ timeout: 15_000 });
  await expect(check).toBeDisabled();
});

test("decision-table ai panel: placeholder visible, explain disabled when unconfigured", async ({ page }) => {
  await page.goto("/en/tools/decision-table");
  await expect(page.getByPlaceholder(/describe or ask/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: /explain this table/i })).toBeDisabled();
});

test("form-builder ai panel: placeholder visible, generate disabled when unconfigured", async ({ page }) => {
  await page.goto("/en/tools/form-builder");
  await expect(page.getByPlaceholder(/describe a form/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: /generate form/i })).toBeDisabled();
});
