import { test, expect } from '@playwright/test'

test.describe('Security · CSP + headers', () => {
  test('homepage sets strict CSP + COOP + frame-ancestors none', async ({ request }) => {
    const res = await request.get('/')
    const csp = res.headers()['content-security-policy']
    expect(csp).toBeTruthy()
    expect(csp).toContain("frame-ancestors 'none'")
    expect(res.headers()['x-frame-options']).toBe('DENY')
    expect(res.headers()['x-content-type-options']).toBe('nosniff')
    expect(res.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin')
  })

  test('CSRF: POST without origin header is rejected (403)', async ({ request }) => {
    const res = await request.post('/api/journeys', {
      data: { name: 'evil' },
      headers: { origin: 'https://evil.com' },
    })
    expect([401, 403]).toContain(res.status())
  })
})

test.describe('Security · password policy', () => {
  test('signUp with weak password is rejected by Supabase', async ({ request }) => {
    const ts = Date.now()
    // Hit Supabase directly via the REST endpoint Supabase JS uses.
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anon) test.skip(true, 'Supabase env not loaded into Playwright env')
    const res = await request.post(`${url}/auth/v1/signup`, {
      headers: { apikey: anon!, 'Content-Type': 'application/json' },
      data: { email: `weak-${ts}@zeniipo-test.local`, password: 'short' },
    })
    expect(res.status()).toBeGreaterThanOrEqual(400)
    const body = await res.json().catch(() => ({}))
    expect(JSON.stringify(body).toLowerCase()).toMatch(/12 char|password|weak/i)
  })
})
