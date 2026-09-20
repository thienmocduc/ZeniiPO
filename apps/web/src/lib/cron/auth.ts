import { timingSafeEqual } from 'node:crypto'

/**
 * XÁC THỰC LỊCH CHẠY ĐỊNH KỲ.
 *
 * ── LỖ HỔNG ĐÃ VÁ Ở ĐÂY (phát hiện 20/09/2026) ──
 * Bản cũ chấp nhận header `x-vercel-cron: 1` là ĐỦ, dựa trên lập luận "Vercel
 * đặt header này và không cho nó đi qua từ internet công cộng". Lập luận đó
 * đúng — **khi ứng dụng chạy trên Vercel**.
 *
 * Ứng dụng đã chuyển sang ZeniCloud (kiểm chứng: zeniipo.com trả
 * `Server: railway-hikari`, không có một header `x-vercel-*` nào). Trên nền
 * tảng mới KHÔNG có gì lọc header đó, nên bất kỳ ai trên internet chỉ cần gửi
 * kèm `x-vercel-cron: 1` là chạy được mọi tác vụ định kỳ — trong đó có
 * `/api/cron/audit-retention` (XOÁ nhật ký kiểm toán cũ),
 * `/api/cron/weekly-digest` (GỬI thư), và `/api/cron/agents` (đốt token AI).
 *
 * Đây là kiểu lỗ hổng sinh ra từ việc ĐỔI NỀN TẢNG chứ không phải từ dòng mã
 * nào viết sai: mã giữ nguyên mà giả định nền dưới nó đã khác.
 *
 * Nay chỉ còn MỘT cách vào: bí mật chia sẻ, so sánh theo thời gian hằng định.
 * Thiếu `CRON_SECRET` thì TỪ CHỐI HẾT — thà lịch không chạy (thấy ngay) còn
 * hơn cổng mở cho cả internet (không ai thấy).
 */
function bangNhau(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

export function isAuthorizedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  // Fail-closed: chưa cấu hình bí mật thì không ai gọi được.
  if (!secret) return false

  const auth = req.headers.get('authorization') ?? ''
  const mong = `Bearer ${secret}`
  if (auth.length !== mong.length) return false
  return bangNhau(auth, mong)
}
