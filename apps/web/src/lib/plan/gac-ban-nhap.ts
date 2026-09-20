import type { ZeniClient } from '@/lib/zeni/compat'

/**
 * BẢN KẾ HOẠCH ĐÃ CHỐT THÌ KHÔNG SỬA.
 *
 * `plan_versions.status='published'` là bất biến (ràng buộc #3 masterspec):
 * muốn đổi thì tạo bản mới, bản cũ giữ vĩnh viễn để nhà đầu tư đối chiếu
 * "hứa" với "làm". CSDL đã có trigger chặn, nhưng chặn ở đây để trả lời bằng
 * tiếng Việt kèm hướng đi tiếp, thay vì ném lỗi trigger khó hiểu.
 *
 * ⚠ Hàm này nằm ở `lib/` chứ KHÔNG nằm trong một `route.ts`: Next.js chỉ cho
 * phép `route.ts` xuất các hàm phương thức HTTP (GET/POST/...) và vài khoá cấu
 * hình. Xuất thêm hàm thường ở đó thì `tsc` vẫn xanh nhưng `next build` đổ ở
 * bước kiểm kiểu — đã dính đúng lỗi này một lần.
 */
export async function kiemBanNhap(
  supabase: ZeniClient,
  versionId: string,
): Promise<{ ok: true } | { ok: false; message: string; status: number }> {
  const { data: v } = await supabase
    .from('plan_versions')
    .select('id, status, version_no')
    .eq('id', versionId)
    .maybeSingle()
  if (!v) return { ok: false, message: 'Không tìm thấy bản kế hoạch', status: 404 }
  if ((v as { status?: string }).status === 'published') {
    const so = (v as { version_no?: number }).version_no
    return {
      ok: false,
      message:
        `Bản kế hoạch v${so} đã CHỐT nên không sửa được. ` +
        'Tạo bản mới (sao chép từ bản này) — bản đã chốt giữ vĩnh viễn để nhà đầu tư soi "hứa vs làm".',
      status: 409,
    }
  }
  return { ok: true }
}
