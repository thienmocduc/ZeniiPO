import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'
import { safeString } from '@/lib/security/schemas'
import {
  GIOI_HAN_BYTE_CSDL,
  GIOI_HAN_BYTE_ZENICLOUD,
  cauHinhLuuTru,
  duongDanLuuTru,
  kiemTep,
  taiLenZeniCloud,
} from '@/lib/luu-tru/ho-so'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
/** Tệp thẩm định có thể vài chục MB — mặc định 10 giây là không đủ. */
export const maxDuration = 60

/**
 * TẢI HỒ SƠ LÊN PHÒNG DỮ LIỆU.
 *
 * Đây là mắt nối còn thiếu của cả chuỗi bằng chứng: `data_room_docs` trước nay
 * chỉ được ĐỌC ở mọi nơi trong mã, nên `ipo_readiness_criteria.evidence_file_id`
 * không bao giờ có giá trị, và **điểm sẵn sàng đã xác minh không bao giờ vượt
 * được 0** — dù doanh nghiệp làm đủ mọi việc.
 *
 * Bốn lớp kiểm, theo thứ tự rẻ đến đắt:
 *   1. Phiên đăng nhập + doanh nghiệp
 *   2. Kích thước — chặn trước khi đọc hết byte vào bộ nhớ
 *   3. Loại tệp: danh sách CHO PHÉP, và đối chiếu BYTE ĐẦU TỆP (không tin
 *      `content-type` do phía gọi khai)
 *   4. Băm SHA-256 lưu kèm, để sau chứng minh được tệp chưa bị tráo
 */

const MetaSchema = z.object({
  title: safeString.min(1).max(200),
  category: safeString.max(60).optional(),
  folder_id: z.string().uuid().optional(),
})

export async function POST(req: Request) {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json(
      { error: 'Yêu cầu phải là multipart/form-data có trường "file"' },
      { status: 400 },
    )
  }

  const tep = form.get('file')
  if (!(tep instanceof File)) {
    return NextResponse.json({ error: 'Thiếu trường "file"' }, { status: 400 })
  }

  const cau = cauHinhLuuTru()
  const gioiHan = cau ? GIOI_HAN_BYTE_ZENICLOUD : GIOI_HAN_BYTE_CSDL

  // Chặn theo kích thước khai báo TRƯỚC khi nạp byte vào bộ nhớ. Đọc hết rồi mới
  // chặn nghĩa là một yêu cầu 500 MB vẫn ăn 500 MB RAM của tiến trình.
  if (tep.size > gioiHan) {
    return NextResponse.json(
      {
        error:
          `Tệp ${(tep.size / 1048576).toFixed(1)} MB, vượt hạn mức ` +
          `${(gioiHan / 1048576).toFixed(0)} MB` +
          (cau ? '' : ' (đang giữ tạm trong cơ sở dữ liệu nên hạn mức thấp hơn)'),
      },
      { status: 413 },
    )
  }

  const parsed = MetaSchema.safeParse({
    title: String(form.get('title') ?? tep.name ?? '').trim() || tep.name,
    category: (form.get('category') as string | null)?.trim() || undefined,
    folder_id: (form.get('folder_id') as string | null) || undefined,
  })
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const byte = Buffer.from(await tep.arrayBuffer())
  const kiem = kiemTep(tep.type, byte, gioiHan)
  if (!kiem.ok) return NextResponse.json({ error: kiem.loi }, { status: 415 })

  const key = duongDanLuuTru(auth.tenantId, kiem.duoi)

  // ── Nơi chính: lớp lưu trữ ZeniCloud ──
  let storagePath: string
  let nhaCungCap: 'zenicloud' | 'csdl'
  let canhBao: string | null = null

  if (cau) {
    const up = await taiLenZeniCloud(cau, key, byte, kiem.mime)
    if (!up.ok) {
      // Không âm thầm rơi về CSDL khi lớp lưu trữ CÓ cấu hình mà lỗi: đó là sự
      // cố hạ tầng cần biết, không phải trạng thái bình thường.
      return NextResponse.json({ error: up.loi }, { status: 502 })
    }
    storagePath = up.storage_path
    nhaCungCap = 'zenicloud'
  } else {
    storagePath = `csdl://blob/pending`
    nhaCungCap = 'csdl'
    canhBao =
      'Lớp lưu trữ ZeniCloud chưa được nạp khoá nên tệp đang giữ tạm trong cơ sở dữ liệu. ' +
      'Tính năng dùng được bình thường; cần chuyển sang lớp lưu trữ khi khoá sẵn sàng.'
  }

  const { data: doc, error } = await supabase
    .from('data_room_docs')
    .insert({
      tenant_id: auth.tenantId,
      folder_id: parsed.data.folder_id ?? null,
      title: parsed.data.title,
      category: parsed.data.category ?? null,
      storage_path: storagePath,
      file_size_bytes: byte.length,
      mime_type: kiem.mime,
      sha256: kiem.sha256,
      uploaded_by: auth.user.id,
      nha_cung_cap: nhaCungCap,
      ten_tep_goc: tep.name,
    })
    .select('id, title, storage_path, file_size_bytes, mime_type, sha256, nha_cung_cap, created_at')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const d = doc as { id: string }

  if (nhaCungCap === 'csdl') {
    const { error: loiBlob } = await supabase
      .from('data_room_blobs')
      .insert({ doc_id: d.id, noi_dung: byte })
    if (loiBlob) {
      // Bản ghi hồ sơ không có byte là bản ghi nói dối. Dọn lại rồi báo lỗi.
      await supabase.from('data_room_docs').delete().eq('id', d.id).eq('tenant_id', auth.tenantId)
      return NextResponse.json(
        { error: `Không lưu được nội dung tệp: ${loiBlob.message}` },
        { status: 500 },
      )
    }
    await supabase
      .from('data_room_docs')
      .update({ storage_path: `csdl://blob/${d.id}` })
      .eq('id', d.id)
      .eq('tenant_id', auth.tenantId)
  }

  return NextResponse.json({ data: doc, canh_bao: canhBao }, { status: 201 })
}

/** Danh sách hồ sơ + thống kê nơi lưu. */
export async function GET() {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const [{ data, error }, { data: tk }] = await Promise.all([
    supabase
      .from('data_room_docs')
      .select(
        'id, title, category, mime_type, file_size_bytes, sha256, nha_cung_cap, ten_tep_goc, created_at',
      )
      .eq('tenant_id', auth.tenantId)
      .order('created_at', { ascending: false }),
    supabase.rpc('thong_ke_ho_so', { p_tenant: auth.tenantId }),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    data,
    thong_ke: tk ?? null,
    lop_luu_tru: cauHinhLuuTru() ? 'zenicloud' : 'chua_nap_khoa',
  })
}
