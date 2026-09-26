import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'
import { cauHinhLuuTru, duongTaiVe, taiByteZeniCloud } from '@/lib/luu-tru/ho-so'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * TẢI HỒ SƠ VỀ.
 *
 * Hai đường, tuỳ byte nằm ở đâu:
 *   · `zenicloud://…` → trả về đường có chữ ký, hạn 5 phút, trình duyệt tải
 *     trực tiếp. Không đẩy byte qua Cloud Run: mỗi lần tải sẽ chiếm một tiến
 *     trình, và tệp thẩm định có thể vài chục MB.
 *   · `csdl://blob/…` → phát byte từ CSDL.
 *
 * ⚠ BA TIÊU ĐỀ BẮT BUỘC khi phát byte:
 *   `Content-Disposition: attachment` — buộc tải về, không mở trong tab. Một
 *      tệp mở trong tab chạy dưới chính miền của ứng dụng.
 *   `X-Content-Type-Options: nosniff` — chặn trình duyệt tự đoán lại loại tệp.
 *      Không có nó thì trình duyệt có thể coi một tệp txt là HTML rồi chạy nó.
 *   `Cache-Control: private, no-store` — hồ sơ thẩm định không được nằm lại
 *      trong bộ đệm dùng chung.
 * Tải lên đã chặn HTML và SVG, nhưng ba tiêu đề này là lớp phòng thứ hai: hồ sơ
 * cũ nạp từ nơi khác vào vẫn có thể là loại nguy hiểm.
 */

/**
 * Gột tên tệp cho tiêu đề HTTP.
 *
 * Tên gốc do người ngoài đặt: nó chứa được dấu ngoặc kép và ký tự điều khiển làm
 * vỡ tiêu đề `Content-Disposition`, và vỡ tiêu đề là một đường tiêm.
 */
function tenTepAnToan(d: { ten_tep_goc: string | null; title: string }): string {
  return (d.ten_tep_goc ?? d.title ?? 'ho-so').replace(/[^\w.\-]+/g, '_').slice(0, 120)
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Mã hồ sơ không hợp lệ' }, { status: 400 })
  }

  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  // Lọc theo tenant ngay trong câu truy vấn. RLS cũng canh, nhưng một endpoint
  // tải tệp thì không nên dựa vào một lớp duy nhất.
  const { data: doc } = await supabase
    .from('data_room_docs')
    .select('id, title, storage_path, mime_type, file_size_bytes, sha256, nha_cung_cap, ten_tep_goc')
    .eq('id', id)
    .eq('tenant_id', auth.tenantId)
    .maybeSingle()
  if (!doc) return NextResponse.json({ error: 'Không tìm thấy hồ sơ' }, { status: 404 })

  const d = doc as {
    id: string
    title: string
    storage_path: string | null
    mime_type: string | null
    sha256: string | null
    ten_tep_goc: string | null
  }
  const duong = d.storage_path ?? ''

  if (duong.startsWith('zenicloud://')) {
    const cau = cauHinhLuuTru()
    if (!cau) {
      return NextResponse.json(
        {
          error:
            'Tệp nằm trên lớp lưu trữ ZeniCloud nhưng ứng dụng chưa được nạp khoá lưu trữ — ' +
            'không xin được đường tải về.',
        },
        { status: 503 },
      )
    }
    const r = await duongTaiVe(cau, duong)
    if (r.ok) {
      return NextResponse.json({ data: { url: r.url, het_han_sau_giay: 300, sha256: d.sha256 } })
    }

    // Ký đường tải về hỏng phía nền tảng (đo 26/09: "Project was not passed and
    // could not be determined from the environment"). Lấy byte qua endpoint proxy
    // của CÙNG lớp lưu trữ, để tệp tải lên vẫn tải về được.
    // ⚠ Không che: header `X-Zeni-Luu-Tru` nói rõ đang chạy đường dự phòng, nếu
    // không thì lỗi nền tảng biến mất khỏi tầm nhìn và không bao giờ được sửa.
    const byte = await taiByteZeniCloud(cau, duong)
    if (!byte.ok) {
      return NextResponse.json(
        { error: `Không ký được đường tải về (${r.loi}) và cũng không lấy được byte (${byte.loi})` },
        { status: 502 },
      )
    }
    return new NextResponse(new Uint8Array(byte.byte), {
      status: 200,
      headers: {
        'Content-Type': d.mime_type ?? 'application/octet-stream',
        'Content-Length': String(byte.byte.length),
        'Content-Disposition': `attachment; filename="${tenTepAnToan(d)}"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
        'X-Zeni-Luu-Tru': 'proxy-du-phong; ky-duong-dan-loi',
      },
    })
  }

  if (duong.startsWith('csdl://blob/')) {
    const { data: blob, error } = await supabase
      .from('data_room_blobs')
      .select('noi_dung')
      .eq('doc_id', id)
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!blob) {
      return NextResponse.json(
        { error: 'Bản ghi hồ sơ có nhưng nội dung tệp không còn' },
        { status: 410 },
      )
    }

    const raw = (blob as { noi_dung: unknown }).noi_dung
    const byte = Buffer.isBuffer(raw)
      ? raw
      : typeof raw === 'string'
        ? Buffer.from(raw.replace(/^\\x/, ''), 'hex')
        : Buffer.from(raw as Uint8Array)

    const ten = tenTepAnToan(d)

    return new NextResponse(new Uint8Array(byte), {
      status: 200,
      headers: {
        'Content-Type': d.mime_type ?? 'application/octet-stream',
        'Content-Length': String(byte.length),
        'Content-Disposition': `attachment; filename="${ten}"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    })
  }

  return NextResponse.json(
    {
      error:
        `Hồ sơ không có nơi lưu hợp lệ (storage_path = "${duong || 'rỗng'}"). ` +
        'Bản ghi này có trước khi đường tải lên tồn tại.',
    },
    { status: 409 },
  )
}
