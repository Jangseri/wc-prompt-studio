import { test, expect } from "@playwright/test";

test.describe("Legacy /legacy (3-tab UI)", () => {
  test("renders the header with app title and three tabs", async ({ page }) => {
    const res = await page.goto("/legacy");
    expect(res?.status(), "HTTP status for /legacy").toBeLessThan(500);

    await expect(page).toHaveTitle(/WC Prompt Studio/);
    await expect(page.getByRole("heading", { name: "WC Prompt Studio" })).toBeVisible();

    await expect(page.getByRole("button", { name: /자동 생성/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /정형화/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /프롬프트 관리/ })).toBeVisible();
  });

  test("legacy header exposes a '기본 UI' link that routes to /", async ({ page }) => {
    await page.goto("/legacy");
    await page.getByRole("link", { name: /기본 UI/ }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("clicking main tabs swaps the body content", async ({ page }) => {
    await page.goto("/legacy");

    // Default tab = 자동 생성. Upload dropzone should be visible.
    await expect(
      page.getByText(/파일을 드래그하거나 클릭하여 업로드/).first()
    ).toBeVisible();

    // Switch to 정형화
    await page.getByRole("button", { name: /정형화/ }).click();
    await expect(page.getByRole("heading", { name: "영역화" })).toBeVisible();

    // Switch back to 자동 생성
    await page.getByRole("button", { name: /자동 생성/ }).click();
    await expect(
      page.getByText(/파일을 드래그하거나 클릭하여 업로드/).first()
    ).toBeVisible();
  });
});
