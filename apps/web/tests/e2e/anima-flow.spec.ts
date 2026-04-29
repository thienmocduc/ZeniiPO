import { test, expect } from '@playwright/test'

const ANIMA_EMAIL = process.env.E2E_ANIMA_EMAIL ?? 'chairman@anima.zeniipo.com'
const ANIMA_PASS = process.env.E2E_ANIMA_PASSWORD ?? 'Anima@Zeniipo2026!Strong'

test.describe('Anima Chairman · authenticated flow', () => {
  test('login → onboarding gate (or dashboard if already onboarded)', async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[type="email"]').first().fill(ANIMA_EMAIL)
    await page.locator('input[type="password"]').first().fill(ANIMA_PASS)
    await Promise.all([
      page.waitForURL(/\/(onboarding|dashboard)/, { timeout: 15000 }),
      page.locator('button[type="submit"]').first().click(),
    ])
    const url = page.url()
    expect(url).toMatch(/\/(onboarding|dashboard)/)
  })

  test('settings-security page renders 3 cards', async ({ page }) => {
    // Login first
    await page.goto('/login')
    await page.locator('input[type="email"]').first().fill(ANIMA_EMAIL)
    await page.locator('input[type="password"]').first().fill(ANIMA_PASS)
    await page.locator('button[type="submit"]').first().click()
    await page.waitForURL(/\/(onboarding|dashboard)/, { timeout: 15000 })
    // If onboarding, can't reach settings-security yet — skip.
    if (page.url().includes('/onboarding')) test.skip(true, 'Tenant not onboarded yet')
    await page.goto('/settings-security')
    await expect(page.getByText(/đổi mật khẩu/i)).toBeVisible()
    await expect(page.getByText(/đổi email/i)).toBeVisible()
    await expect(page.getByText(/xác thực 2 bước/i)).toBeVisible()
  })
})
