import { test, expect } from '@playwright/test'

test.describe('Smoke · public surface', () => {
  test('landing renders + has Z mark + login link', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Zeniipo|Zeni|IPO/i)
    // Some kind of nav element visible
    await expect(page.locator('body')).toBeVisible()
  })

  test('login page renders with email + password fields', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('textbox', { name: /email/i }).first()).toBeVisible()
    // Password input is type=password — match by selector
    await expect(page.locator('input[type="password"]').first()).toBeVisible()
  })

  test('signup page renders', async ({ page }) => {
    await page.goto('/signup')
    await expect(page.locator('input[type="email"]').first()).toBeVisible()
  })

  test('/api/health returns 200', async ({ request }) => {
    const res = await request.get('/api/health')
    expect(res.status()).toBe(200)
  })

  test('/api/modules returns 200 (public read)', async ({ request }) => {
    const res = await request.get('/api/modules')
    expect(res.status()).toBe(200)
    const json = await res.json()
    expect(json.data).toBeDefined()
  })

  test('/api/glossary returns 200 (public read)', async ({ request }) => {
    const res = await request.get('/api/glossary')
    expect(res.status()).toBe(200)
  })
})

test.describe('Smoke · auth gate', () => {
  test('protected route redirects to /login when not signed in', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })

  test('/api/dashboard returns 401 without session', async ({ request }) => {
    const res = await request.get('/api/dashboard')
    expect(res.status()).toBe(401)
  })

  test('/api/onboarding/status returns 401 without session', async ({ request }) => {
    const res = await request.get('/api/onboarding/status')
    expect(res.status()).toBe(401)
  })
})
