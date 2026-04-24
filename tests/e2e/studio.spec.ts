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
  test("renders the three-column shell with idle welcome in the center", async ({
    page,
  }) => {
    const res = await page.goto("/");
    expect(res?.status(), "HTTP status for /").toBeLessThan(500);

    await expect(page.getByRole("link", { name: /Legacy UI/i })).toBeVisible();

    // LEFT: Companies sidebar
    await expect(page.getByRole("heading", { name: /Companies/i })).toBeVisible();
    // "New workflow" button exists in the sidebar
    await expect(page.getByRole("button", { name: /New workflow/i }).first()).toBeVisible();

    // CENTER: idle welcome (no Workflow yet)
    await expect(page.getByRole("heading", { name: /WC Prompt Studio/i })).toBeVisible();
    await expect(page.getByText(/새 워크플로를 시작해/)).toBeVisible();

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

  test("New workflow opens the 5-step wizard, setup gates advancement", async ({
    page,
  }) => {
    await page.goto("/");

    // Click "New workflow" in the idle panel to enter workflow mode
    await page
      .getByRole("button", { name: /New workflow/i })
      .first()
      .click();

    const companyInput = page.getByPlaceholder(/__TEST__hospital/);
    const staffInput = page.getByPlaceholder("예: 1");
    const nextBtn = page.getByRole("button", { name: /다음: 소스/ });

    await expect(companyInput).toBeVisible();
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
      page.getByText(/프롬프트 구성이 채워지면 여기에 실시간 미리보기가 보입니다/)
    ).toBeVisible();
  });

  test("KB tab prompts to pick a company when none is set", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /^KB$/ }).click();
    await expect(
      page.getByText(/선택된 회사가 없습니다/)
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
    // Expanded: staff row appears
    await expect(page.getByRole("button", { name: /staff\s+1\b/ })).toBeVisible();
  });
});
