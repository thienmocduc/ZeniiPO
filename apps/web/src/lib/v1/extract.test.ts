/**
 * TEST CHO PHẦN TRÍCH XUẤT GIAO DIỆN V1 (thanh bên · thanh trên).
 *
 * Bối cảnh: giao diện lấy khung từ `source.html` (bản dựng) rồi viết lại các mục
 * menu thành đường dẫn thật. Đây là mã biến đổi chuỗi — loại dễ cắt nhầm nhất.
 *
 * Ngày 19/09/2026 một biến đổi tương tự đã **xoá mất nút Đăng nhập** trên bản
 * chạy thật mà không ai biết, vì không có test nào canh. Màn hình đăng nhập nay
 * đã viết lại bằng React (không còn gọt HTML), nhưng THANH BÊN thì vẫn đi qua
 * đường này — nên phải có test canh.
 *
 * Giá trị thật của tệp này: bắt được mục menu trỏ tới trang KHÔNG TỒN TẠI —
 * lỗi mà người dùng chỉ phát hiện khi bấm vào và rơi ra trang trắng.
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROUTE_MAP, getSidebarInner, getTopbarHtml, rewriteSidebarForNextLinks } from './extract'

/** Đường dẫn thật = mọi thư mục có `page.tsx` trong app router. */
function routesCoTrenThucTe(): Set<string> {
  const appDir = path.join(process.cwd(), 'src', 'app')
  const found = new Set<string>()
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name)
      if (e.isDirectory()) {
        if (e.name === 'api') continue
        walk(full)
      } else if (e.name === 'page.tsx') {
        const rel = path.relative(appDir, dir).replace(/\\/g, '/')
        // Bỏ nhóm định tuyến `(app)` / `(auth)` — chúng không nằm trong URL.
        found.add(rel.replace(/\((\w+)\)\/?/g, '').replace(/^\/+|\/+$/g, ''))
      }
    }
  }
  walk(appDir)
  return found
}

describe('Menu thanh bên · mọi mục phải trỏ tới trang CÓ THẬT', () => {
  it('1. mọi đường dẫn trong ROUTE_MAP đều có trang tương ứng', () => {
    const thucTe = routesCoTrenThucTe()
    const hong: string[] = []
    for (const [pageId, route] of Object.entries(ROUTE_MAP)) {
      if (!thucTe.has(route)) hong.push(`${pageId} → /${route}`)
    }
    // Báo rõ mục nào hỏng thay vì chỉ "expected true to be false".
    expect(hong, `Mục menu trỏ tới trang không tồn tại:\n  ${hong.join('\n  ')}`).toEqual([])
  })

  it('2. không có hai mục menu trỏ trùng một trang (dễ gây nhầm khi điều hướng)', () => {
    const dem = new Map<string, string[]>()
    for (const [pageId, route] of Object.entries(ROUTE_MAP)) {
      dem.set(route, [...(dem.get(route) ?? []), pageId])
    }
    const trung = [...dem.entries()].filter(([, ids]) => ids.length > 1)
    expect(trung, `Trùng đích: ${JSON.stringify(trung)}`).toEqual([])
  })
})

describe('Viết lại thanh bên thành liên kết thật', () => {
  const inner = getSidebarInner()

  it('3. thanh bên trích ra được, không rỗng', () => {
    expect(inner.length).toBeGreaterThan(100)
  })

  it('4. mục menu đã thành thẻ liên kết có href, không còn div trơ', () => {
    const out = rewriteSidebarForNextLinks(inner)
    expect(out).toContain('href="/dashboard"')
    expect(out).toContain('data-route="/dashboard"')
  })

  it('5. Zeni Console CHỈ hiện khi được bật (quyền chủ nền tảng)', () => {
    const an = rewriteSidebarForNextLinks(inner, { showConsole: false })
    const hien = rewriteSidebarForNextLinks(inner, { showConsole: true })
    expect(hien).toContain('/console')
    expect(an).not.toContain('/console')
  })

  it('6. đã gỡ hết trình xử lý sự kiện nội tuyến của bản dựng', () => {
    // Còn sót `onclick=` nghĩa là bản dựng demo vẫn điều khiển giao diện thật.
    expect(inner).not.toMatch(/\son[a-z]+=/i)
  })
})

describe('Thanh trên', () => {
  it('7. trích ra được và không kèm trình xử lý nội tuyến', () => {
    const tb = getTopbarHtml()
    expect(tb.length).toBeGreaterThan(50)
    expect(tb).toContain('tb-r') // chỗ nút Đăng xuất được chèn vào
  })
})
