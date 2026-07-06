import { test, expect } from "@playwright/test";

const URL = "/en/tools/flow-builder";

test("renders the sample flow as React Flow nodes", async ({ page }) => {
  await page.goto(URL);
  const nodes = page.locator(".react-flow__node");
  await expect(nodes.first()).toBeVisible({ timeout: 15_000 });
  expect(await nodes.count()).toBeGreaterThanOrEqual(6);
});

test("palette adds a node", async ({ page }) => {
  await page.goto(URL);
  await page.locator(".react-flow__node").first().waitFor({ timeout: 15_000 });
  const before = await page.locator(".react-flow__node").count();
  await page.getByRole("button", { name: /\+ action/i }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(before + 1);
});

test("live JSON panel reflects the flow", async ({ page }) => {
  await page.goto(URL);
  await page.locator(".react-flow__node").first().waitFor({ timeout: 15_000 });
  await expect(page.getByText('"version": 1')).toBeVisible();
});
