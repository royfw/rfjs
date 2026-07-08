import { test, expect } from "@playwright/test";

const URL = "/en/tools/table-builder";

test("renders the sample table and paginates", async ({ page }) => {
  await page.goto(URL);
  const rows = page.locator("table tbody tr");
  await expect(rows.first()).toBeVisible({ timeout: 15_000 });
  const firstCell = await rows.first().textContent();
  // Next.js dev-tools overlay also exposes a button named "Open Next.js Dev Tools" that
  // partially matches /next/i, so match the pagination control's exact label instead.
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(rows.first()).not.toHaveText(firstCell ?? "", { timeout: 15_000 });
});
