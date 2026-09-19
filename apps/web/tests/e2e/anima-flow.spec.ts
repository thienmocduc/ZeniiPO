import { test, expect } from '@playwright/test'

/**
 * LUỒNG ĐÃ ĐĂNG NHẬP — cần một tài khoản Zeni ID thật để chạy.
 *
 * Trước đây tệp này nhúng sẵn email + mật khẩu ngay trong mã làm giá trị mặc
 * định. Hai cái sai cùng lúc:
 *
 *  1. Mật khẩu nằm trong kho mã — dù chỉ là tài khoản thử thì vẫn là thói quen
 *     phải bỏ (quy tắc: bí mật đi qua biến môi trường, không nằm trong git).
 *  2. Khi tài khoản đó không tồn tại (ví dụ sau khi dựng lại cơ sở dữ liệu), test
 *     chạy tiếp rồi CHẾT vì hết giờ chờ chuyển trang — báo "hỏng" trong khi sự
 *     thật là "chưa có tài khoản để thử". Báo sai như vậy làm loãng tín hiệu:
 *     người đọc kết quả không phân biệt được lỗi sản phẩm với lỗi thiếu dữ liệu.
 *
 * Nay: chưa khai biến ⇒ BỎ QUA, kèm lý do rõ. Muốn chạy thì khai
 * `E2E_ANIMA_EMAIL` và `E2E_ANIMA_PASSWORD` (máy cá nhân dùng .env.local, CI
 * dùng secrets của kho).
 */
const ANIMA_EMAIL = process.env.E2E_ANIMA_EMAIL
const ANIMA_PASS = process.env.E2E_ANIMA_PASSWORD

test.describe('Anima Chairman · luồng đã đăng nhập', () => {
  test.skip(
    !ANIMA_EMAIL || !ANIMA_PASS,
    'Chưa khai E2E_ANIMA_EMAIL / E2E_ANIMA_PASSWORD — không có tài khoản thật để thử.',
  )

  /** Đăng nhập rồi chờ rời khỏi màn hình đăng nhập. */
  async function dangNhap(page: import('@playwright/test').Page) {
    await page.goto('/login')
    await page.locator('input[type="email"]').first().fill(ANIMA_EMAIL!)
    await page.locator('input[type="password"]').first().fill(ANIMA_PASS!)
    await page.locator('#loginBtn, button[type="submit"]').first().click()

    // Sai mật khẩu thì màn hình hiện dải báo lỗi — bắt trường hợp đó và nói
    // thẳng, thay vì để hết giờ chờ rồi báo một lỗi điều hướng khó hiểu.
    const loi = page.locator('[role="alert"]')
    const doi = await Promise.race([
      page.waitForURL(/\/(onboarding|dashboard)/, { timeout: 15000 }).then(() => 'vao-duoc'),
      loi.waitFor({ state: 'visible', timeout: 15000 }).then(() => 'bi-tu-choi'),
    ])
    if (doi === 'bi-tu-choi') {
      throw new Error(`Đăng nhập bị từ chối: "${await loi.innerText()}" — kiểm lại tài khoản thử.`)
    }
  }

  test('đăng nhập → vào được cổng onboarding hoặc bảng điều khiển', async ({ page }) => {
    await dangNhap(page)
    expect(page.url()).toMatch(/\/(onboarding|dashboard)/)
  })

  test('trang cài đặt bảo mật hiện đủ 3 thẻ', async ({ page }) => {
    await dangNhap(page)
    // Chưa onboarding xong thì chưa tới được trang này.
    if (page.url().includes('/onboarding')) test.skip(true, 'Tổ chức chưa onboarding xong')
    await page.goto('/settings-security')
    await expect(page.locator('h2', { hasText: 'Đổi mật khẩu' }).first()).toBeVisible()
    await expect(page.locator('h2', { hasText: 'Đổi email' }).first()).toBeVisible()
    await expect(page.locator('h2', { hasText: 'Xác thực 2 bước' }).first()).toBeVisible()
  })
})
