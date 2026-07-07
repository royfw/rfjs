import { test, expect } from "@playwright/test";

const URL = "/en/tools/decision-table";

test("renders the sample decision table", async ({ page }) => {
  await page.goto(URL);
  // 描述也出現在 Table-JSON 回顯 → 限定在規則列(避免 strict-mode 多重匹配)。
  await expect(
    page.getByTestId("dt-rules-list").getByText(/big spend goes to the cfo/i),
  ).toBeVisible({ timeout: 15_000 });
});

test("single evaluation routes a big amount to the CFO", async ({ page }) => {
  await page.goto(URL);
  await page.locator("#dt-context").fill('{"amount": 200000, "dept": "Engineering"}');
  await page.getByRole("button", { name: /^evaluate$/i }).first().click();
  // "approver": "CFO" 也在 Table-JSON 裡 → 限定在單筆試算結果。
  await expect(
    page.getByTestId("dt-single-result").getByText(/"approver": "CFO"/),
  ).toBeVisible({ timeout: 15_000 });
});

test("table json panel shows the document", async ({ page }) => {
  await page.goto(URL);
  await expect(page.getByText('"version": 1').first()).toBeVisible({ timeout: 15_000 });
});
