import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'
import { createServiceClient } from '@/lib/supabase/service'
import { isCurrentSuperAdmin } from '@/lib/zeni/superadmin'
import { kiemQuyen } from '@/lib/goi/han-muc'
import { chatComplete, isAIConfigured, DEFAULT_MODEL } from '@/lib/agents/client'
import {
  NHAC_TRICH_SO,
  cauHinhZeniCloud,
  taiTrang,
  urlAnToan,
  xacMinhTrichDan,
  type DongDeXuat,
} from '@/lib/nghien-cuu/tra-nguon'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
/** Tải và trích nhiều trang — mặc định 10 giây không đủ. */
export const maxDuration = 300

/**
 * TRA NGUỒN THỊ TRƯỜNG VÀ CÔNG TY SO SÁNH.
 *
 * Đây là lớp 3 của cổng khả thi. Lớp 1 (`kiem_kha_thi_chien_luoc`) cần hai thứ
 * mà hôm nay đều trống: bội số EV/Doanh thu của ngành, và tỷ giá. Endpoint này
 * là đường nạp chúng vào — bằng dữ liệu CÓ NGUỒN, không bằng ký ức mô hình.
 *
 * Quy trình, và lý do từng bước tồn tại:
 *   1. `urlAnToan()`  — chặn địa chỉ nội bộ. Người dùng đưa URL, máy chủ đi tải:
 *      đó là định nghĩa của lỗ SSRF.
 *   2. `taiTrang()`   — tải trang THẬT qua lớp browser của ZeniCloud.
 *   3. mô hình trích  — chỉ được trích từ văn bản vừa tải, kèm đoạn nguyên văn.
 *   4. `xacMinhTrichDan()` — kiểm bằng MÁY: đoạn trích phải có thật trong trang,
 *      con số phải có thật trong đoạn trích. Không thoả thì LOẠI.
 *
 * ⚠ Bước 4 là lý do endpoint này đáng tin. Không có nó, `market_data.source_url`
 * sẽ trỏ tới những trang chưa từng chứa con số được ghi — tức là bịa kèm nguồn
 * giả, loại tệ nhất vì nó trông như đã kiểm.
 *
 * ⚠ MỌI DÒNG GHI VÀO ĐỀU MANG NHÃN `confidence` VÀ `source_url`. Người chốt là
 * người, không phải mô hình.
 */

const Body = z.object({
  urls: z.array(z.string().max(2048)).min(1).max(5),
  loai: z.enum(['thi_truong', 'so_sanh_niem_yet', 'ty_gia']),
  /** Chỉ dùng cho `thi_truong`, để xếp số liệu vào đúng ngành. */
  industry_code: z.string().max(20).optional(),
})

type DongTyGia = {
  base_ccy: string
  quote_ccy: string
  rate: number
  rate_type?: string
  ten_ngan_hang: string
  ngay_cong_bo?: string
  trich_dan: string
}

type DongSoSanh = {
  company_name: string
  ticker?: string
  exchange?: string
  revenue_usd: number
  enterprise_value_usd?: number
  market_cap_usd?: number
  trich_dan: string
  confidence?: number
}

/** Cắt bớt văn bản trang trước khi đưa vào mô hình — cửa vào giới hạn 20.000 ký tự. */
const CAT = 16000

export async function POST(req: Request) {
  if (!isAIConfigured()) {
    return NextResponse.json(
      { error: 'Chưa nạp khoá lớp AI — không trích số liệu được. Đây là điều kiện hạ tầng, không phải lỗi nhập liệu.' },
      { status: 503 },
    )
  }
  const cau = cauHinhZeniCloud()
  if (!cau) {
    return NextResponse.json(
      {
        error:
          'Chưa nạp khoá ZeniCloud (ZENICLOUD_API · ZENICLOUD_WS · ZENICLOUD_STORAGE_TOKEN) — ' +
          'không gọi được lớp tải trang.',
      },
      { status: 503 },
    )
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const quyen = await kiemQuyen(supabase, auth.tenantId, 'nghien_cuu_thi_truong')
  if (!quyen.ok) {
    return NextResponse.json(
      { error: quyen.message, goi: quyen.goi, can_goi: quyen.can_goi },
      { status: quyen.status },
    )
  }

  // ⚠ TỶ GIÁ LÀ DỮ LIỆU TOÀN NỀN TẢNG, KHÔNG THUỘC MỘT DOANH NGHIỆP.
  // `fx_rates` không có cột `tenant_id`, và đã kiểm bằng đúng vai trên
  // production: vai `authenticated` bị RLS chặn khi ghi ("new row violates
  // row-level security policy"), chỉ vai chủ ghi được. Nên chế độ này là việc
  // của chủ tịch nền tảng, và phải ghi qua service client.
  if (parsed.data.loai === 'ty_gia' && !(await isCurrentSuperAdmin())) {
    return NextResponse.json(
      {
        error:
          'Chỉ chủ tịch nền tảng mới nạp được tỷ giá. Tỷ giá dùng chung cho mọi doanh nghiệp — ' +
          'để một khách tự đặt thì mọi mô hình tài chính trên nền tảng đổi theo.',
      },
      { status: 403 },
    )
  }

  const ketQua: Array<Record<string, unknown>> = []
  let tongNhan = 0
  let tongLoai = 0

  for (const raw of parsed.data.urls) {
    const an = urlAnToan(raw)
    if (!an.ok) {
      ketQua.push({ url: raw, ok: false, loi: an.loi })
      continue
    }

    const trang = await taiTrang(cau, an.url)
    if (!trang.ok) {
      ketQua.push({ url: an.url, ok: false, loi: trang.loi })
      continue
    }
    const vanBan = trang.text.slice(0, CAT)

    const nhacThem =
      parsed.data.loai === 'ty_gia'
        ? `\n\nLần này trích TỶ GIÁ ngân hàng công bố. Mỗi dòng:
[{"base_ccy":"USD","quote_ccy":"VND","rate":0,"rate_type":"spot|closing|average","ten_ngan_hang":"...","ngay_cong_bo":"YYYY-MM-DD","trich_dan":"..."}]
Quy ước: 1 base_ccy = rate quote_ccy. "ten_ngan_hang" phải là tên ngân hàng ghi TRONG trang, không suy ra từ tên miền. Không có tên ngân hàng thì bỏ dòng đó.`
        : parsed.data.loai === 'so_sanh_niem_yet'
        ? `\n\nLần này trích CÔNG TY NIÊM YẾT để so sánh. Mỗi dòng:
[{"company_name":"...","ticker":"...","exchange":"...","revenue_usd":0,"enterprise_value_usd":0,"market_cap_usd":0,"trich_dan":"...","confidence":0.0-1.0}]
Chỉ ghi con số nào văn bản nêu rõ. Không suy ra, không quy đổi đơn vị, không ước lượng.`
        : ''

    let tho: string
    try {
      const r = await chatComplete({
        system: NHAC_TRICH_SO + nhacThem,
        user: `TIÊU ĐỀ TRANG: ${trang.title}\nĐỊA CHỈ: ${an.url}\n\nVĂN BẢN:\n${vanBan}`,
        model: DEFAULT_MODEL,
        maxTokens: 3000,
        // Nhiệt độ 0: đây là việc TRÍCH, không phải việc sáng tác.
        temperature: 0,
      })
      tho = r.text
    } catch (e) {
      ketQua.push({ url: an.url, ok: false, loi: `Mô hình lỗi: ${(e as Error).message}` })
      continue
    }

    // Mô hình hay bọc JSON trong khối mã dù đã dặn không — gỡ trước khi đọc.
    const json = tho.replace(/^[\s\S]*?(\[)/, '$1').replace(/```[\s\S]*$/, '').trim()
    let dong: unknown
    try {
      dong = JSON.parse(json)
    } catch {
      ketQua.push({ url: an.url, ok: false, loi: 'Mô hình không trả JSON đọc được' })
      continue
    }
    if (!Array.isArray(dong)) {
      ketQua.push({ url: an.url, ok: false, loi: 'Mô hình không trả mảng' })
      continue
    }

    if (parsed.data.loai === 'ty_gia') {
      const ds = dong as DongTyGia[]
      // Xác minh bằng chính bộ dùng chung: gắn `value_numeric` = tỷ giá.
      const kiem = xacMinhTrichDan(
        trang.text,
        ds.map((x) => ({
          metric_type: `${x.base_ccy}/${x.quote_ccy}`,
          value_numeric: Number(x.rate),
          value_unit: x.quote_ccy ?? '',
          trich_dan: x.trich_dan ?? '',
        })),
      )
      const nhanCap = new Set(kiem.nhan.map((x) => x.metric_type))
      // Chú thích của `fx_rates` yêu cầu source là "tên ngân hàng + ngày công bố".
      // Dòng không có tên ngân hàng thì KHÔNG đạt chuẩn của chính bảng đó.
      const nhan = ds.filter(
        (x) => nhanCap.has(`${x.base_ccy}/${x.quote_ccy}`) && String(x.ten_ngan_hang ?? '').trim().length >= 2,
      )
      tongNhan += nhan.length
      tongLoai += ds.length - nhan.length

      if (nhan.length > 0) {
        const sb = createServiceClient()
        const { error } = await sb.from('fx_rates').upsert(
          nhan.map((x) => ({
            base_ccy: String(x.base_ccy).toUpperCase().slice(0, 3),
            quote_ccy: String(x.quote_ccy).toUpperCase().slice(0, 3),
            rate: Number(x.rate),
            effective_from: x.ngay_cong_bo ?? new Date().toISOString().slice(0, 10),
            rate_type: ['spot', 'closing', 'average'].includes(String(x.rate_type))
              ? String(x.rate_type)
              : 'spot',
            source: `${String(x.ten_ngan_hang).slice(0, 80)} · công bố ${x.ngay_cong_bo ?? 'không ghi ngày'}`,
            note: `Trích tự động, đoạn dẫn đã xác minh: "${String(x.trich_dan).slice(0, 240)}" · nguồn: ${an.url}`,
          })),
          { onConflict: 'base_ccy,quote_ccy,effective_from,rate_type' },
        )
        if (error) {
          ketQua.push({ url: an.url, ok: false, loi: `Không ghi được tỷ giá: ${error.message}` })
          continue
        }
      }
      ketQua.push({
        url: an.url,
        ok: true,
        tieu_de: trang.title,
        so_nhan: nhan.length,
        so_loai: ds.length - nhan.length,
        bi_loai: [
          ...kiem.loai.map((x) => ({ cap: x.dong.metric_type, ly_do: x.ly_do })),
          ...ds
            .filter((x) => String(x.ten_ngan_hang ?? '').trim().length < 2)
            .map((x) => ({
              cap: `${x.base_ccy}/${x.quote_ccy}`,
              ly_do: 'Không nêu được tên ngân hàng — bảng fx_rates yêu cầu nguồn là tên ngân hàng kèm ngày công bố',
            })),
        ],
      })
      continue
    }

    if (parsed.data.loai === 'thi_truong') {
      const ds = dong as DongDeXuat[]
      const kiem = xacMinhTrichDan(trang.text, ds)
      tongNhan += kiem.nhan.length
      tongLoai += kiem.loai.length

      if (kiem.nhan.length > 0) {
        const { error } = await supabase.from('market_data').insert(
          kiem.nhan.map((d) => ({
            tenant_id: auth.tenantId,
            metric_type: String(d.metric_type).slice(0, 60),
            region: d.region ? String(d.region).slice(0, 60) : null,
            segment: d.segment ? String(d.segment).slice(0, 60) : null,
            value_numeric: d.value_numeric,
            value_unit: String(d.value_unit ?? '').slice(0, 30),
            source: `AI trích từ trang · ${trang.title}`.slice(0, 200),
            source_url: an.url,
            confidence: d.confidence ?? null,
            notes: `Đoạn trích đã xác minh có thật trong trang: "${d.trich_dan.slice(0, 300)}"`,
          })),
        )
        if (error) {
          ketQua.push({ url: an.url, ok: false, loi: `Không ghi được: ${error.message}` })
          continue
        }
      }
      ketQua.push({
        url: an.url,
        ok: true,
        tieu_de: trang.title,
        so_nhan: kiem.nhan.length,
        so_loai: kiem.loai.length,
        // Nói rõ vì sao bị loại: im lặng bỏ bớt thì người dùng tưởng trang
        // không có gì, trong khi thật ra mô hình đã bịa và bị chặn.
        bi_loai: kiem.loai.map((x) => ({ metric: x.dong.metric_type, so: x.dong.value_numeric, ly_do: x.ly_do })),
      })
      continue
    }

    // ── Công ty so sánh ──
    const ds = dong as DongSoSanh[]
    // Dùng chung bộ xác minh: gắn `value_numeric` = doanh thu để kiểm đoạn trích.
    const dungKiem: DongDeXuat[] = ds.map((x) => ({
      metric_type: x.company_name ?? '?',
      value_numeric: Number(x.revenue_usd),
      value_unit: 'USD',
      trich_dan: x.trich_dan ?? '',
      confidence: x.confidence,
    }))
    const kiem = xacMinhTrichDan(trang.text, dungKiem)
    const nhanTen = new Set(kiem.nhan.map((x) => x.metric_type))
    const nhan = ds.filter((x) => nhanTen.has(x.company_name ?? '?'))
    tongNhan += nhan.length
    tongLoai += ds.length - nhan.length

    if (nhan.length > 0) {
      const { error } = await supabase.from('comparables').insert(
        nhan.map((x) => {
          const ev = x.enterprise_value_usd ?? x.market_cap_usd ?? null
          const dt = Number(x.revenue_usd)
          return {
            tenant_id: auth.tenantId,
            company_name: String(x.company_name).slice(0, 160),
            ticker: x.ticker ? String(x.ticker).slice(0, 20) : null,
            exchange: x.exchange ? String(x.exchange).slice(0, 20) : null,
            revenue_usd: Math.round(dt),
            enterprise_value_usd: ev != null ? Math.round(ev) : null,
            // ⚠ BỘI SỐ TÍNH BẰNG PHÉP CHIA, KHÔNG HỎI MÔ HÌNH. Đây là con số
            // mà cả cổng khả thi dựa vào; để mô hình tự tính là mời sai số vào
            // đúng chỗ quan trọng nhất.
            ev_revenue_multiple: ev != null && dt > 0 ? Number((ev / dt).toFixed(4)) : null,
          }
        }),
      )
      if (error) {
        ketQua.push({ url: an.url, ok: false, loi: `Không ghi được: ${error.message}` })
        continue
      }
    }
    ketQua.push({
      url: an.url,
      ok: true,
      tieu_de: trang.title,
      so_nhan: nhan.length,
      so_loai: ds.length - nhan.length,
      bi_loai: kiem.loai.map((x) => ({ cong_ty: x.dong.metric_type, ly_do: x.ly_do })),
    })
  }

  return NextResponse.json({
    data: {
      loai: parsed.data.loai,
      tong_nhan: tongNhan,
      tong_loai: tongLoai,
      theo_trang: ketQua,
      ghi_chu:
        'Mọi dòng được ghi đều kèm source_url và đoạn trích ĐÃ XÁC MINH có thật trong trang. ' +
        'Dòng bị loại là dòng mô hình không chứng minh được — xem `bi_loai` để biết lý do. ' +
        'Số liệu này là ĐỀ XUẤT: người phụ trách phải soát trước khi dùng để ra quyết định.',
    },
  })
}
