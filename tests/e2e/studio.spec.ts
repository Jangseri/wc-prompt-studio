import { test, expect, type Route } from "@playwright/test";

/**
 * All /studio tests mock /api/companies at the browser fetch layer so
 * they are hermetic: no dependency on the real orchestrator DB being
 * reachable with valid credentials.
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

test.describe("Unified workspace /studio", () => {
  test("renders the three-column shell and minimal header", async ({ page }) => {
    const res = await page.goto("/studio");
    expect(res?.status(), "HTTP status for /studio").toBeLessThan(500);

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

  test("cross-nav 'Legacy UI' returns to /", async ({ page }) => {
    await page.goto("/studio");
    await page.getByRole("link", { name: /Legacy UI/i }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("button", { name: /자동 생성/ })).toBeVisible();
  });

  test("setup step gates advancement until both identifiers are filled", async ({
    page,
  }) => {
    await page.goto("/studio");

    const companyInput = page.getByPlaceholder(/__TEST__hospital/);
    const staffInput = page.getByPlaceholder("예: 1");
    const nextBtn = page.getByRole("button", { name: /다음: 소스/ });

    await expect(nextBtn).toBeDisabled();

    await companyInput.fill("__TEST__e2e");
    await expect(nextBtn).toBeDisabled();

    await staffInput.fill("1");
    await expect(nextBtn).toBeEnabled();

    await nextBtn.click();
    // Source step is now active; its next-button is disabled until
    // files + channel + industry are set
    await expect(page.getByText(/소스 파일/)).toBeVisible();
    await expect(page.getByRole("button", { name: /다음: 분석/ })).toBeDisabled();
  });

  test("right panel Preview tab shows empty-state prompt initially", async ({
    page,
  }) => {
    await page.goto("/studio");
    await expect(
      page.getByText(/8영역을 작성하면 여기에 실시간 조립된 프롬프트가 보입니다/)
    ).toBeVisible();
  });

  test("KB tab prompts for company_seq when none is set", async ({ page }) => {
    await page.goto("/studio");
    await page.getByRole("button", { name: /^KB$/ }).click();
    await expect(
      page.getByText(/Setup 스텝에서 company_seq를 입력하면/)
    ).toBeVisible();
  });

  test("sidebar renders rows from mocked /api/companies", async ({ page }) => {
    const responsePromise = page.waitForResponse((resp) =>
      resp.url().includes("/api/companies")
    );
    await page.goto("/studio");
    const response = await responsePromise;
    expect(response.status()).toBe(200);

    // The mocked row should surface in the sidebar list
    await expect(page.getByRole("button", { name: /__TEST__demo/ })).toBeVisible();

    // Expand → inline rows appear
    await page.getByRole("button", { name: /__TEST__demo/ }).click();
    await expect(page.getByText("PD2000")).toBeVisible();
    await expect(page.getByText("PA4000")).toBeVisible();
  });
});
