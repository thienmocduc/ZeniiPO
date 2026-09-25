/**
 * SERVICE CLIENT (bỏ qua RLS) — chạy bằng VAI CHỦ, không SET ROLE.
 *
 * CHỈ dùng ở ngữ cảnh máy-gọi-máy đã tự xác thực (cron + CRON_SECRET, ingest
 * token băm, internal + x-internal-key, console sau khi `is_chairman_super`).
 * Tuyệt đối không đưa đầu vào người dùng chưa kiểm soát vào đây.
 *
 * ⚠ TRƯỚC BẢN VÁ NÀY NÓ KHÔNG HỀ BỎ QUA RLS. Tệp này vẫn ghi "chạy dưới user
 * owner" nhưng lại gọi `getPool()` — và `DATABASE_URL` từ khi siết bảo mật đã
 * trỏ về `zeniipo_com_runtime`, vai KHÔNG sở hữu bảng. Nên RLS vẫn áp và mọi
 * truy vấn trả RỖNG, không ném lỗi nào.
 *
 * Đo trên production: cùng một câu hỏi, vai chủ thấy 1 tenant / 1 user_profiles
 * / 466 plan_targets, vai runtime thấy 0 / 0 / 0.
 *
 * Hệ quả im lặng: hợp đồng ba tầng gửi ZeniOS/ZeniERP luôn rỗng, bốn tác vụ
 * định kỳ "chạy thành công" với 0 bản ghi, cổng nạp dữ liệu từ ERP không thấy
 * gì. Đây là hồi quy do chính việc chuyển DATABASE_URL sang vai runtime để bật
 * cách ly dữ liệu — siết đúng chỗ này thì vỡ chỗ kia, và không có test nào
 * canh vì cả hai đều "không lỗi".
 */
import { getOwnerPool } from '@/lib/zeni/db'
import { makeClient, type Runner, type ZeniClient } from '@/lib/zeni/compat'

let cached: ZeniClient | null = null

export function createServiceClient(): ZeniClient {
  if (cached) return cached
  const runner: Runner = async (work) =>
    work(async (text, params) => {
      const res = await getOwnerPool().query(text, params as never[])
      return { rows: res.rows, rowCount: res.rowCount }
    })
  cached = makeClient(runner, async () => null)
  return cached
}
