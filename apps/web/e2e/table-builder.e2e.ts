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

test("importing json then filtering shrinks the rows", async ({ page }) => {
  await page.goto(URL);
  // Import a small JSON array via the Source panel's paste textbox + Load button.
  // NOTE: match "Load" with exact:true -- /load/i substring-matches "Upload" too, which
  // trips Playwright's strict-mode "resolved to 2 elements" error. Upload stays a
  // label-wrapped <input type="file"> (not a <button>) so it never competes with Load.
  // Wait for hydration before typing: the paste box is a controlled textarea pre-filled with
  // the sample rows, so filling it pre-hydration races React re-asserting its state value
  // (the fill and the sample JSON end up concatenated -> "Invalid JSON.").
  const paste = page.getByPlaceholder("Paste JSON or CSV…");
  await expect(paste).toHaveValue(/Sample Item/, { timeout: 15_000 });
  await paste.fill('[{"id":1,"price":10},{"id":2,"price":90}]');
  await page.getByRole("button", { name: "Load", exact: true }).click();
  await expect(page.locator("table tbody tr")).toHaveCount(2, { timeout: 15_000 });

  // Mark "price" filterable in the Columns panel, then open the Filter section and add a
  // price >= 50 condition -- should shrink the table to the one row that satisfies it.
  // The filter toggle's accessible name is "Filter" plus a live "N matched" suffix (or the
  // disabled hint), so match by substring rather than exact. The operator select has no
  // `operatorLabels` override in this tool, so it falls back to the raw op id ("gte").
  await page.getByRole("button", { name: "Columns", exact: true }).click();
  await page.getByRole("checkbox", { name: "Filter price" }).check();
  await page.getByRole("button", { name: "Filter" }).click();
  await page.getByRole("button", { name: "+ condition" }).click();
  await page.getByRole("combobox", { name: "field" }).click();
  await page.getByRole("option", { name: "price" }).click();
  await page.getByRole("combobox", { name: "operator" }).click();
  await page.getByRole("option", { name: "gte", exact: true }).click();
  await page.getByRole("textbox", { name: "value" }).fill("50");
  await expect(page.locator("table tbody tr")).toHaveCount(1, { timeout: 15_000 });
});

test("metadata tab shows the reverse-projected meta json", async ({ page }) => {
  await page.goto(URL);
  await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Metadata", exact: true }).click();

  const pre = page.getByTestId("metadata-json");
  await expect(pre).toContainText('"fields"');
  await expect(pre).toContainText('"price"');
});

test("fetcher mode: applying a remote filter shrinks the result set", async ({ page }) => {
  await page.goto(URL);
  await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 15_000 });

  // 切到假 fetcher(Source 頁籤是預設頁籤)
  await page.getByRole("button", { name: "Fake fetcher" }).click();
  await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Filter" }).click();
  await page.getByRole("button", { name: "+ condition" }).click();
  await page.getByRole("combobox", { name: "field" }).click();
  await page.getByRole("option", { name: "price" }).click();
  await page.getByRole("combobox", { name: "operator" }).click();
  await page.getByRole("option", { name: "gte", exact: true }).click();
  await page.getByRole("textbox", { name: "value" }).fill("40");
  await page.getByRole("button", { name: "Apply", exact: true }).click();

  // SAMPLE_ROWS 的 price = 10 + n*3.5(n=1..18)→ gte 40 命中 n>=9,共 10 筆
  await expect(page.getByText("10 rows")).toBeVisible({ timeout: 15_000 });
});
