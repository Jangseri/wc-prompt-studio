import { test, expect, type Route } from "@playwright/test";

/**
 * After the step-9 swap, the unified workspace is served at `/` and
 * the legacy 3-tab UI is reachable at `/legacy`. These tests target
 * the new default route.
 *
 * /api/companies is mocked at the browser fetch layer so tests are
 * hermetic and do not depend on the real orchestrator DB.
 */
const mockCompanies = (route: Route) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      success: true,
      data: [
        {
          company_seq: "__TEST__demo",
          ai_staff_seq: "1",
          svc_cd: "SA1000",
          prmt_cd: "PD2000",
          status: "Y",
          updt_dt: "2026-04-22 12:00:00",
        },
        {
          company_seq: "__TEST__demo",
          ai_staff_seq: "1",
          svc_cd: "SA1000",
          prmt_cd: "PA4000",
          status: "Y",
          updt_dt: "2026-04-22 11:00:00",
        },
      ],
    }),
  });

test.beforeEach(async ({ page }) => {
  await page.route("**/api/companies**", mockCompanies);
});

test.describe("Unified workspace / (default after swap)", () => {
  test("renders the three-column shell and minimal header", async ({ page }) => {
    const res = await page.goto("/");
    expect(res?.status(), "HTTP status for /").toBeLessThan(500);

    await expect(page.getByRole("link", { name: /Legacy UI/i })).toBeVisible();

    // LEFT: Companies sidebar
    await expect(page.getByRole("heading", { name: /Companies/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /New workflow/i })).toBeVisible();

    // CENTER: Workflow
    await expect(page.getByRole("heading", { name: "Workflow" })).toBeVisible();

    // RIGHT: Preview / Chat / KB tabs
    await expect(page.getByRole("button", { name: /^Preview$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Chat$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^KB$/ })).toBeVisible();
  });

  test("cross-nav 'Legacy UI' routes to /legacy", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Legacy UI/i }).click();
    await expect(page).toHaveURL(/\/legacy$/);
    await expect(page.getByRole("button", { name: /자동 생성/ })).toBeVisible();
  });

  test("setup step gates advancement until both identifiers are filled", async ({
    page,
  }) => {
    await page.goto("/");

    const companyInput = page.getByPlaceholder(/__TEST__hospital/);
    const staffInput = page.getByPlaceholder("예: 1");
    const nextBtn = page.getByRole("button", { name: /다음: 소스/ });

    await expect(nextBtn).toBeDisabled();

    await companyInput.fill("__TEST__e2e");
    await expect(nextBtn).toBeDisabled();

    await staffInput.fill("1");
    await expect(nextBtn).toBeEnabled();

    await nextBtn.click();
    await expect(page.getByText(/소스 파일/)).toBeVisible();
    await expect(page.getByRole("button", { name: /다음: 분석/ })).toBeDisabled();
  });

  test("right panel Preview tab shows empty-state prompt initially", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByText(/8영역을 작성하면 여기에 실시간 조립된 프롬프트가 보입니다/)
    ).toBeVisible();
  });

  test("KB tab prompts for company_seq when none is set", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /^KB$/ }).click();
    await expect(
      page.getByText(/Setup 스텝에서 company_seq를 입력하면/)
    ).toBeVisible();
  });

  test("sidebar renders rows from mocked /api/companies", async ({ page }) => {
    const responsePromise = page.waitForResponse((resp) =>
      resp.url().includes("/api/companies")
    );
    await page.goto("/");
    const response = await responsePromise;
    expect(response.status()).toBe(200);

    await expect(page.getByRole("button", { name: /__TEST__demo/ })).toBeVisible();

    await page.getByRole("button", { name: /__TEST__demo/ }).click();
    await expect(page.getByText("PD2000")).toBeVisible();
    await expect(page.getByText("PA4000")).toBeVisible();
  });
});
