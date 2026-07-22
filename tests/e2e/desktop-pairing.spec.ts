import { test, expect } from '@playwright/test'

/**
 * Smoke tests for public web routes used in the desktop pairing flow.
 * Run with: PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test
 */
test.describe('public pairing routes', () => {
  test.skip(!process.env.PLAYWRIGHT_BASE_URL, 'Set PLAYWRIGHT_BASE_URL to run E2E')

  test('desktop auth page loads', async ({ page }) => {
    await page.goto('/desktop/auth?provider=google')
    await expect(page.locator('body')).toContainText(/sign|google|clarifi/i)
  })

  test('trust page loads', async ({ page }) => {
    await page.goto('/trust')
    await expect(page.locator('body')).toContainText(/trust|security|data/i)
  })

  test('privacy page loads', async ({ page }) => {
    await page.goto('/privacy')
    await expect(page.locator('body')).toContainText(/privacy/i)
  })
})
