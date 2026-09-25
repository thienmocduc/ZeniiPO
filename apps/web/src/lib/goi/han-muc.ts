import type { ZeniClient } from '@/lib/zeni/compat'

/**
 * KHOÁ TÍNH NĂNG THEO GÓI — một cửa hỏi duy nhất cho mọi route.
 *
 * Luật giới hạn nằm ở CSDL (migration 044), không rải ra 130 route: luật kinh
 * doanh rải ra từng nơi thì sớm muộn có nơi quên kiểm, và đổi chính sách giá
 * phải đi sửa khắp nơi.
 *
 * Trước migration 044, `membership_tiers` khai giới hạn thật cho 5 gói nhưng
 * KHÔNG một dòng mã nào đọc tới. Trả 120 triệu cũng không mở thêm gì, mà không
 * trả đồng nào cũng không bị chặn gì.
 */

export type ViecCanQuyen = 'tao_hanh_trinh' | 'them_ghe' | 'hoc_vien' | 'thao_truong'

export type KetQuaQuyen =
  | { ok: true; goi: string }
  | { ok: false; message: string; status: number; goi: string | null; can_goi: string | null }

/**
 * Hỏi CSDL xem doanh nghiệp này được làm việc đó không.
 *
 * ⚠ FAIL-OPEN KHI KHÔNG HỎI ĐƯỢC. Nếu chính lời gọi RPC lỗi (mất kết nối, hàm
 * chưa nạp) thì CHO QUA. Một trục trặc hạ tầng không được biến thành "khách
 * trả tiền bị khoá tính năng" — đó là cách nhanh nhất mất khách. Giới hạn gói
 * là chuyện doanh thu, không phải chuyện an toàn; ranh giới bảo mật thật nằm
 * ở RLS, và RLS thì fail-closed.
 */
export async function kiemQuyen(
  supabase: ZeniClient,
  tenantId: string,
  viec: ViecCanQuyen,
): Promise<KetQuaQuyen> {
  const { data, error } = await supabase.rpc('duoc_dung', { p_tenant: tenantId, p_viec: viec })
  if (error) return { ok: true, goi: 'khong-tra-duoc' }

  const r = (Array.isArray(data) ? data[0] : data) as
    | { cho_phep: boolean; ly_do: string | null; goi: string | null; can_goi: string | null }
    | null
    | undefined
  if (!r) return { ok: true, goi: 'khong-tra-duoc' }
  if (r.cho_phep) return { ok: true, goi: r.goi ?? 'free' }

  return {
    ok: false,
    // 402 Payment Required: đúng nghĩa, và giao diện phân biệt được với 403
    // (không đủ quyền) để hiện nút nâng gói thay vì báo "bạn không có quyền".
    status: 402,
    message: r.ly_do ?? 'Gói hiện tại chưa mở tính năng này.',
    goi: r.goi,
    can_goi: r.can_goi,
  }
}
