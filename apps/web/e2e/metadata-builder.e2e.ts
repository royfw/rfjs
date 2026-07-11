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

  // 預設樣本已含 filterable 欄位;試篩編輯器加一條條件,欄位下拉應含 author.name
  await page.getByRole("button", { name: "+ condition" }).click();
  await page.getByRole("combobox", { name: "field" }).click();
  await expect(page.getByRole("option", { name: "author.name" })).toBeVisible();
});
