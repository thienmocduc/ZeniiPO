'use client'

/**
 * AccountMenu — nút ĐĂNG XUẤT trên thanh trên cùng.
 *
 * Kiểm kê 18/09/2026 phát hiện: toàn hệ thống KHÔNG có chỗ nào đăng xuất được
 * (đã quét cả `source.html`, sidebar, topbar) — trong khi 2 endpoint đăng xuất
 * đã viết xong và chạy tốt, chỉ là không ai gọi. Người dùng vào rồi không có
 * đường ra là lỗi nghiêm trọng, nhất là khi dùng máy chung.
 *
 * Thanh trên cùng được dựng từ HTML tĩnh của bản dựng, nên ta chèn nút vào
 * `.tb-r` sau khi trang mount (cùng cách `IdentityBind` vá danh tính).
 * Phòng thủ: không tìm thấy chỗ chèn thì thôi, không làm vỡ giao diện.
 */

import { useEffect } from 'react'

const BTN_ID = 'za-logout'

export function AccountMenu({ email }: { email?: string | null }) {
  useEffect(() => {
    const host = document.querySelector<HTMLElement>('.tb-r')
    if (!host || document.getElementById(BTN_ID)) return

    const btn = document.createElement('button')
    btn.id = BTN_ID
    btn.className = 'tb-btn'
    btn.type = 'button'
    btn.textContent = '⏻'
    btn.title = email ? `Đăng xuất (${email})` : 'Đăng xuất'
    btn.setAttribute('aria-label', btn.title)

    btn.addEventListener('click', () => {
      btn.disabled = true
      btn.textContent = '…'
      // Gửi kèm cookie để máy chủ xoá đúng phiên; dù lỗi mạng vẫn đưa người
      // dùng về trang đăng nhập — không được kẹt lại trong phiên đã muốn thoát.
      fetch('/api/auth/zeni/logout', { method: 'POST', credentials: 'same-origin' })
        .catch(() => undefined)
        .finally(() => {
          window.location.href = '/login'
        })
    })

    host.appendChild(btn)
    return () => {
      btn.remove()
    }
  }, [email])

  return null
}
