import { test, expect } from "@playwright/test";

const URL = "/en/tools/decision-table";

test("renders the sample decision table", async ({ page }) => {
  await page.goto(URL);
  await expect(page.getByText(/big spend goes to the cfo/i)).toBeVisible({ timeout: 15_000 });
});

test("single evaluation routes a big amount to the CFO", async ({ page }) => {
  await page.goto(URL);
  await page.locator("#dt-context").fill('{"amount": 200000, "dept": "Engineering"}');
  await page.getByRole("button", { name: /^evaluate$/i }).first().click();
  await expect(page.getByText(/"approver": "CFO"/)).toBeVisible({ timeout: 15_000 });
});

test("table json panel shows the document", async ({ page }) => {
  await page.goto(URL);
  await expect(page.getByText('"version": 1').first()).toBeVisible({ timeout: 15_000 });
});
