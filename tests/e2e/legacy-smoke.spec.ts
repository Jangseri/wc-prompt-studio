import { test, expect } from '@playwright/test'

test('legacy / route renders without a server error', async ({ page }) => {
  const response = await page.goto('/')
  expect(response?.status(), 'HTTP status from GET /').toBeLessThan(500)
  await expect(page.locator('body')).toBeVisible()
})
