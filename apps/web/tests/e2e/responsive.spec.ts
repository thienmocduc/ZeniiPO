import { test, expect, devices } from '@playwright/test'

/**
 * Mobile responsive verification — 10 core routes at iPhone 13 viewport.
 * Asserts:
 *   1. page loads (200 or 307 redirect — protected routes redirect to /login)
 *   2. body has no horizontal overflow (clientWidth ≤ viewportWidth + 1px tolerance)
 *   3. no rendering errors logged to console
 */

const MOBILE = devices['iPhone 13']
const VIEWPORT = MOBILE.viewport // { width: 390, height: 844 }

test.use({ ...MOBILE })

const PUBLIC_ROUTES = ['/', '/login', '/signup', '/forgot-password']
const PROTECTED_ROUTES = [
  '/dashboard',
  '/onboarding',
  '/cap-table',
  '/financials',
  '/team',
  '/settings-security',
]

test.describe('Mobile responsive · public routes', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route} renders without horizontal overflow at 390px`, async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))

      const res = await page.goto(route, { waitUntil: 'domcontentloaded' })
      expect(res?.status()).toBeLessThan(400)

      // Wait for layout to settle
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})

      // Check no horizontal overflow
      const overflow = await page.evaluate(() => ({
        bodyW: document.body.scrollWidth,
        winW: window.innerWidth,
      }))
      expect(overflow.bodyW).toBeLessThanOrEqual(overflow.winW + 1)

      // Check no JS errors
      expect(errors).toEqual([])
    })
  }
})

test.describe('Mobile responsive · protected routes redirect', () => {
  for (const route of PROTECTED_ROUTES) {
    test(`${route} (no auth) redirects to /login at 390px`, async ({ page }) => {
      await page.goto(route, { waitUntil: 'domcontentloaded' })
      await page.waitForURL(/\/login/, { timeout: 5000 }).catch(() => {})
      expect(page.url()).toMatch(/\/login/)
    })
  }
})

test.describe('Mobile responsive · viewport meta', () => {
  test('homepage has viewport meta with width=device-width', async ({ page }) => {
    await page.goto('/')
    const content = await page.locator('meta[name="viewport"]').first().getAttribute('content')
    expect(content).toContain('width=device-width')
  })
})
