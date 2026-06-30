import { test, expect } from "@playwright/test";

const URL = "/en/tools/bpmn-viewer";

test("renders the default BPMN diagram as SVG", async ({ page }) => {
  await page.goto(URL);
  // bpmn-js renders SVG inside .djs-container; the default sample has at least one shape.
  const shapes = page.locator(".djs-container svg .djs-element");
  await expect(shapes.first()).toBeVisible({ timeout: 15_000 });
});

test("keeps the bpmn.io attribution badge visible (license)", async ({ page }) => {
  await page.goto(URL);
  await expect(page.locator(".bjs-powered-by")).toBeVisible({ timeout: 15_000 });
});

test("shows an error panel for invalid pasted XML", async ({ page }) => {
  await page.goto(URL);
  await page.getByLabel(/paste bpmn xml/i).fill("not really xml <<<");
  await page.getByRole("button", { name: /^render$/i }).click();
  // Next.js also has a hidden route-announcer div[role="alert"]; target the
  // visible error paragraph specifically.
  await expect(page.locator('p[role="alert"]')).toBeVisible({ timeout: 15_000 });
});
