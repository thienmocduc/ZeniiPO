import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'
import { safeString, safeUuid } from '@/lib/security/schemas'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * PHÊ DUYỆT — ký vào một kết luận, và ký vào ĐÚNG nội dung tại thời điểm ký.
 *
 * Trước endpoint này, cả 78 bảng chỉ có duy nhất `data_room_docs` mang cột
 * người duyệt. `valuation_runs` chỉ có `created_by`: người chạy mô hình cũng
 * là người duy nhất đứng sau con số đem vào tài liệu chào bán.
 *
 * ── HAI ĐIỀU MÁY CHỦ TỰ QUYẾT, KHÔNG NHẬN TỪ TRÌNH DUYỆT ──
 *   · `nguoi_duyet` lấy từ phiên đăng nhập. Nhận từ thân yêu cầu thì ai cũng
 *     khai được là người khác đã duyệt hộ mình.
 *   · `noi_dung_hash` do CSDL tính. Nhận từ máy khách thì ký một đằng nội
 *     dung một nẻo, và chữ ký thành vô nghĩa.
 *
 * Tách vai (kiểm soát nội bộ, SOX 404): người lập KHÔNG được tự duyệt. Ràng
 * buộc nằm ở CSDL nên đi cửa nào cũng bị chặn; ở đây chỉ chặn sớm để báo lỗi
 * bằng tiếng Việt cho dễ hiểu.
 */

const LOAI = ['valuation_run', 'plan_version', 'cap_table_snapshot', 'board_resolution'] as const

/** Bảng và cột giữ người lập, cho từng loại đối tượng. */
const NGUON: Record<(typeof LOAI)[number], { bang: string; cotNguoiSoan: string | null }> = {
  valuation_run: { bang: 'valuation_runs', cotNguoiSoan: 'created_by' },
  plan_version: { bang: 'plan_versions', cotNguoiSoan: 'published_by' },
  cap_table_snapshot: { bang: 'cap_table_snapshots', cotNguoiSoan: null },
  board_resolution: { bang: 'board_resolutions', cotNguoiSoan: null },
}

const TEN_LOAI: Record<(typeof LOAI)[number], string> = {
  valuation_run: 'lần định giá',
  plan_version: 'bản kế hoạch',
  cap_table_snapshot: 'ảnh chụp cổ phần',
  board_resolution: 'nghị quyết hội đồng',
}

const Body = z.object({
  doi_tuong: z.enum(LOAI),
  doi_tuong_id: safeUuid,
  ghi_chu: safeString.max(1000).optional(),
})

export async function POST(req: Request) {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const parsed = Body.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const { doi_tuong, doi_tuong_id, ghi_chu } = parsed.data
  const nguon = NGUON[doi_tuong]

  // Đối tượng phải thuộc doanh nghiệp của người ký — RLS đã lọc, nhưng kiểm ở
  // đây để trả 404 rõ ràng thay vì một lỗi khó hiểu từ CSDL.
  const cot = nguon.cotNguoiSoan ? `id, tenant_id, ${nguon.cotNguoiSoan}` : 'id, tenant_id'
  const { data: doiTuong } = await supabase
    .from(nguon.bang)
    .select(cot)
    .eq('id', doi_tuong_id)
    .maybeSingle()
  if (!doiTuong) {
    return NextResponse.json(
      { error: `Không tìm thấy ${TEN_LOAI[doi_tuong]} này trong doanh nghiệp của bạn.` },
      { status: 404 },
    )
  }

  const nguoiSoan = nguon.cotNguoiSoan
    ? ((doiTuong as Record<string, unknown>)[nguon.cotNguoiSoan] as string | null)
    : null

  if (nguoiSoan && nguoiSoan === auth.user.id) {
    return NextResponse.json(
      {
        error:
          `Bạn là người lập ${TEN_LOAI[doi_tuong]} này nên không tự duyệt được. ` +
          'Kiểm soát nội bộ đòi người lập và người duyệt là hai người khác nhau — ' +
          'một chữ ký tự ký không có giá trị kiểm soát nào.',
      },
      { status: 422 },
    )
  }

  // Băm do CSDL tính trên nội dung HIỆN TẠI.
  const { data: bam, error: loiBam } = await supabase.rpc('bam_noi_dung', {
    p_doi_tuong: doi_tuong,
    p_id: doi_tuong_id,
  })
  if (loiBam) return NextResponse.json({ error: loiBam.message }, { status: 500 })
  if (!bam) {
    return NextResponse.json(
      { error: `Không tính được dấu nội dung cho ${TEN_LOAI[doi_tuong]} này.` },
      { status: 422 },
    )
  }

  const { data, error } = await supabase
    .from('phe_duyet')
    .insert({
      tenant_id: auth.tenantId,
      doi_tuong,
      doi_tuong_id,
      noi_dung_hash: bam,
      nguoi_soan: nguoiSoan,
      nguoi_duyet: auth.user.id,
      ghi_chu: ghi_chu ?? null,
    })
    .select()
    .single()

  if (error) {
    // Ký lại đúng nội dung cũ thì đụng ràng buộc duy nhất — đó không phải lỗi.
    if (error.code === '23505') {
      return NextResponse.json(
        { error: `${TEN_LOAI[doi_tuong]} này đã được duyệt với đúng nội dung hiện tại.` },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    data: {
      ...data,
      ghi_chu_he_thong:
        'Chữ ký gắn với nội dung tại thời điểm duyệt. Nội dung đổi sau đó thì ' +
        'phê duyệt này tự hết hiệu lực — không cần ai đi thu hồi.',
    },
  })
}

/** GET ?doi_tuong=&doi_tuong_id= — xem đã duyệt chưa và ai đã ký. */
export async function GET(req: Request) {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const { searchParams } = new URL(req.url)
  const q = z
    .object({ doi_tuong: z.enum(LOAI), doi_tuong_id: safeUuid })
    .safeParse({
      doi_tuong: searchParams.get('doi_tuong'),
      doi_tuong_id: searchParams.get('doi_tuong_id'),
    })
  if (!q.success) return NextResponse.json({ error: q.error.flatten() }, { status: 400 })

  const { data: conHieuLuc } = await supabase.rpc('da_duyet', {
    p_doi_tuong: q.data.doi_tuong,
    p_id: q.data.doi_tuong_id,
  })

  const { data: chuKy } = await supabase
    .from('phe_duyet')
    .select('id, nguoi_soan, nguoi_duyet, duyet_luc, ghi_chu, noi_dung_hash')
    .eq('doi_tuong', q.data.doi_tuong)
    .eq('doi_tuong_id', q.data.doi_tuong_id)
    .order('duyet_luc', { ascending: false })

  const ds = chuKy ?? []
  return NextResponse.json({
    data: {
      con_hieu_luc: conHieuLuc === true,
      so_lan_ky: ds.length,
      chu_ky: ds,
      ghi_chu:
        ds.length > 0 && conHieuLuc !== true
          ? 'Đã từng được duyệt nhưng NỘI DUNG ĐÃ THAY ĐỔI sau đó, nên chữ ký cũ không còn hiệu lực. Cần duyệt lại.'
          : ds.length === 0
            ? 'Chưa có ai duyệt. Số liệu này chưa dùng được cho tài liệu chính thức.'
            : 'Đã duyệt và nội dung vẫn nguyên như lúc ký.',
    },
  })
}
