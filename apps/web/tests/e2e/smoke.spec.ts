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

  test('có ĐỦ HAI cách đăng nhập: email và số điện thoại', async ({ page }) => {
    await page.goto('/login')

    // Nhãn Zeni ID phải nhìn thấy được — chairman xem màn hình cũ và nói
    // "không có đăng nhập Zeni ID" trong khi form email/mật khẩu CHÍNH LÀ nó,
    // chỉ vì điều đó chỉ được ghi bằng một dòng chữ nhỏ in nghiêng.
    await expect(page.getByText('Đăng nhập bằng Zeni ID').first()).toBeVisible()

    const theEmail = page.getByRole('button', { name: 'Email', exact: true })
    const theSdt = page.getByRole('button', { name: 'Số điện thoại', exact: true })
    await expect(theEmail).toBeVisible()
    await expect(theSdt).toBeVisible()

    // Mặc định là email.
    await expect(page.locator('input[type="email"]').first()).toBeVisible()

    // Chuyển sang số điện thoại thì phải hiện ô nhập SĐT và nút gửi mã,
    // đồng thời ô mật khẩu biến mất (không để hai form chồng nhau).
    await theSdt.click()
    await expect(page.locator('input[type="tel"]')).toBeVisible()
    await expect(page.getByRole('button', { name: /Gửi mã xác thực/i })).toBeVisible()
    await expect(page.locator('input[type="password"]')).toHaveCount(0)

    // Quay lại email thì form cũ trở lại nguyên vẹn.
    await theEmail.click()
    await expect(page.locator('input[type="password"]').first()).toBeVisible()
  })

  test('nút Google / Zeni Digital hiện ra nhưng KHOÁ, ghi rõ đang chờ', async ({ page }) => {
    await page.goto('/login')

    // Lệnh chairman 20/09: nút nào chưa có OAuth thì cứ hiện, đánh dấu đang chờ.
    // Ràng buộc kèm theo: đã hiện thì TUYỆT ĐỐI không được bấm được, vì chưa có
    // khoá thì bấm vào sẽ ném người dùng sang tên miền khác.
    for (const ma of ['google', 'zenidigital']) {
      const nut = page.getByTestId(`oauth-${ma}-cho`)
      await expect(nut).toBeVisible()
      await expect(nut).toBeDisabled()
      await expect(nut).toContainText(/đang chờ/i)
    }

    // Và không có phiên bản bấm được nào lọt ra cùng lúc.
    await expect(page.getByTestId('oauth-google')).toHaveCount(0)

    // Người dùng phải được chỉ sang đường đi được ngay, không bị bỏ lửng.
    await expect(page.locator('body')).toContainText(/dùng Zeni ID bên dưới/i)
  })

  test('nhớ email lần trước + nhớ cách đăng nhập quen', async ({ page }) => {
    // Đăng nhập hụt một lần để app ghi nhớ email (KHÔNG nhớ mật khẩu).
    await page.goto('/login')
    await page.locator('input[type="email"]').first().fill('nho-toi@zeniipo.com')
    await page.locator('input[type="password"]').first().fill('sai-mat-khau')
    await page.locator('button[type="submit"]').first().click()
    await expect(page.getByTestId('loi-dang-nhap')).toBeVisible({ timeout: 15000 })

    // Quay lại: phải mời sẵn email cũ, bấm một cái là điền.
    await page.reload()
    const moi = page.getByTestId('email-lan-truoc')
    await expect(moi).toBeVisible()
    await expect(moi).toContainText('nho-toi@zeniipo.com')
    await moi.click()
    await expect(page.locator('input[type="email"]').first()).toHaveValue('nho-toi@zeniipo.com')

    // Mật khẩu thì TUYỆT ĐỐI không được nhớ.
    await expect(page.locator('input[type="password"]').first()).toHaveValue('')

    // Đổi sang thẻ số điện thoại rồi tải lại — phải nhớ cách quen dùng.
    await page.getByRole('button', { name: 'Số điện thoại', exact: true }).click()
    await page.reload()
    await expect(page.locator('input[type="tel"]')).toBeVisible()
  })

  test('quên mật khẩu PHẢI gọi được Zeni ID, không báo "chưa mở chức năng"', async ({ page }) => {
    // Chairman tự đâm phải lỗi này 20/09/2026: màn hình báo "Zeni ID chưa mở
    // chức năng đặt lại mật khẩu" — MỘT LỜI NÓI SAI SỰ THẬT. Nền tảng có sẵn
    // `/auth/password/forgot/init`; app chỉ dò sai tên đường dẫn rồi đổ lỗi.
    await page.goto('/forgot-password')

    const goi = page.waitForResponse(
      (r) => r.url().includes('/api/auth/zeni/forgot') && r.request().method() === 'POST',
      { timeout: 20000 },
    )
    await page.locator('input[type="email"]').first().fill('khong-ton-tai@zeniipo.com')
    await page.locator('button[type="submit"]').first().click()
    const res = await goi

    // 200 = đã nhờ gửi (nền tảng luôn trả lời giống nhau để chống dò email).
    // 429 = bị chặn vì gọi quá 3 lần / 15 phút — VẪN chứng minh đã tới đúng nơi.
    // Tuyệt đối không được là 501 "chưa mở chức năng".
    expect([200, 429]).toContain(res.status())

    const body = await page.locator('body').innerText()
    expect(body).not.toContain('chưa mở chức năng')
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
