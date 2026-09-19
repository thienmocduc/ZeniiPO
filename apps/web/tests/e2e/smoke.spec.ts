import { test, expect } from '@playwright/test'

test.describe('Smoke · public surface', () => {
  test('landing renders + has Z mark + login link', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Zeniipo|Zeni|IPO/i)
    // Some kind of nav element visible
    await expect(page.locator('body')).toBeVisible()
  })

  test('login page renders with email + password + SUBMIT BUTTON', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('input[type="email"]').first()).toBeVisible()
    await expect(page.locator('input[type="password"]').first()).toBeVisible()

    // ⚠ Bài học 19/09/2026: test cũ chỉ kiểm 2 ô nhập, KHÔNG kiểm nút bấm. Một
    // biến đổi HTML đã xoá mất nút Đăng nhập trên bản chạy thật và test vẫn
    // xanh — người dùng vào được trang nhưng không có gì để bấm.
    await expect(page.locator('button[type="submit"], #loginBtn').first()).toBeVisible()

    // Phải có đường sang đăng ký và quên mật khẩu — trước đây là chữ thường
    // không bấm được / href="#".
    await expect(page.locator('a[href="/signup"]')).toBeVisible()
    await expect(page.locator('a[href="/forgot-password"]')).toBeVisible()
  })

  test('đường đăng ký phải NỔI RÕ, không lẫn vào chú thích', async ({ page }) => {
    await page.goto('/login')
    // Chairman nhìn màn hình cũ và hỏi "web độc lập thì phải có trường đăng ký
    // chứ?" — trường đó vẫn luôn có, chỉ là trình bày mờ tới mức không thấy.
    const nut = page.locator('a[href="/signup"]')
    await expect(nut).toBeVisible()
    await expect(nut).toContainText(/Đăng ký/i)

    // Và phải nói thẳng: KHÔNG cần có sẵn tài khoản ở sản phẩm Zeni khác.
    await expect(page.locator('body')).toContainText(/không cần/i)
  })

  test('bấm Đăng ký sang được trang tạo tài khoản thật', async ({ page }) => {
    await page.goto('/login')
    await page.locator('a[href="/signup"]').click()
    await expect(page).toHaveURL(/\/signup/)
    await expect(page.locator('input[type="email"]').first()).toBeVisible()
    await expect(page.locator('input[type="password"]').first()).toBeVisible()
  })

  test('login page KHÔNG còn tàn dư bản dựng demo', async ({ page }) => {
    await page.goto('/login')
    const body = await page.locator('body').innerText()
    // Ô "Công ty" và bộ chọn "Vai trò" của bản dựng không dùng cho đăng nhập
    // thật (tổ chức + vai trò lấy từ hồ sơ), và dòng "DEMO credentials" là sai
    // sự thật trên bản chạy thật.
    expect(body).not.toContain('DEMO credentials')
    expect(body).not.toContain('CHR-001')
    expect(body).not.toContain('ANIMA Care Global')
  })

  test('gõ Enter cũng đăng nhập được (không chỉ bấm nút)', async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[type="email"]').first().fill('khong-ton-tai@zeniipo.com')
    await page.locator('input[type="password"]').first().fill('sai-mat-khau')

    // ⚠ BẢN CŨ CỦA TEST NÀY XANH VÌ LÝ DO SAI (phát hiện 20/09/2026): nó chờ
    // `[role="alert"]` hiện ra, nhưng Next.js tự chèn `#__next-route-announcer__`
    // mang đúng vai trò đó vào MỌI trang — luôn hiện, chữ rỗng. Nên test xanh kể
    // cả khi gõ Enter không gửi gì cả. Nó canh đúng thứ mình muốn canh: KHÔNG.
    //
    // Nay canh thẳng vào bằng chứng không thể giả: có một lượt gọi thật tới
    // API đăng nhập. Đúng/sai mật khẩu không quan trọng — chỉ cần form CÓ gửi.
    const goiApi = page.waitForResponse(
      (r) => r.url().includes('/api/auth/zeni/login') && r.request().method() === 'POST',
      { timeout: 15000 },
    )
    await page.locator('input[type="password"]').first().press('Enter')
    const res = await goiApi
    expect(res.status()).toBe(401) // sai mật khẩu — tới được backend là đạt

    // Và người dùng phải THẤY lỗi, không phải im lặng.
    await expect(page.getByTestId('loi-dang-nhap')).toBeVisible({ timeout: 10000 })
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
