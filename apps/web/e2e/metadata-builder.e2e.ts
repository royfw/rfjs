import { test, expect } from "@playwright/test";

const URL = "/en/tools/metadata-builder";

test("declaring a filterable field surfaces it in the try-filter editor", async ({ page }) => {
  await page.goto(URL);
  await expect(page.getByTestId("meta-json")).toBeVisible({ timeout: 15_000 });

  // Hydration gate(#240 教訓):等頁籤切換真的生效(React handler 已掛上)再互動
  await expect(async () => {
    await page.getByRole("button", { name: "Protocol", exact: true }).click();
    await expect(page.getByRole("switch")).toBeVisible({ timeout: 500 });
  }).toPass({ timeout: 15_000 });
  await page.getByRole("button", { name: "Fields", exact: true }).click();

  // 試篩在程式碼面板的 try filter 頁籤;欄位下拉的斷言要限定 popover 內 ——
  // 左欄欄位列也是 role="option" 且名稱含 author.name,裸查詢會撞 strict mode。
  await page.getByRole("button", { name: "try filter", exact: true }).click();
  await page.getByRole("button", { name: "+ condition" }).click();
  await page.getByRole("combobox", { name: "field" }).click();
  await expect(
    page.locator('[data-slot="popover-content"]').getByRole("option", { name: "author.name" }),
  ).toBeVisible();
});

test("selecting a field switches the code panel to its json fragment", async ({ page }) => {
  await page.goto(URL);
  await expect(page.getByTestId("meta-json")).toBeVisible({ timeout: 15_000 });

  await expect(async () => {
    await page.getByRole("button", { name: "Protocol", exact: true }).click();
    await expect(page.getByRole("switch")).toBeVisible({ timeout: 500 });
  }).toPass({ timeout: 15_000 });
  await page.getByRole("button", { name: "Fields", exact: true }).click();

  await page.getByRole("option", { name: /price/ }).click();
  await expect(page.getByTestId("meta-json")).toContainText('"key": "price"');
  await expect(page.getByTestId("meta-json")).not.toContainText('"request"');

  await page.getByRole("button", { name: "show all" }).click();
  await expect(page.getByTestId("meta-json")).toContainText('"request"');
});
