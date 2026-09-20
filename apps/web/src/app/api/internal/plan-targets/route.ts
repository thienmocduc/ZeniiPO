import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * ZIPO-201 · GET /api/internal/plan-targets?tenant=<slug>&version=<n|active>
 *
 * CONTRACT server-to-server cho ZeniOS: trả chỉ tiêu kế hoạch (BIGINT VND,
 * kỳ THÁNG, mã COA VAS) để OS so plan-vs-actual.
 *
 * Auth 2 LỚP (theo spec):
 *   1. `x-internal-key` — khoá server-to-server (so sánh timing-safe)
 *   2. `x-user-id`      — uid phiên THẬT bên OS, giữ nguyên chuỗi RLS:
 *                         uid không thuộc tenant → trả rows rỗng, KHÔNG lộ dữ liệu
 *
 * GET only. Sai key → 401. POST/PUT/... → 405.
 */

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

export async function GET(req: Request) {
  const internalKey = process.env.INTERNAL_API_KEY ?? ''
  const provided = req.headers.get('x-internal-key') ?? ''
  if (!internalKey) {
    return NextResponse.json(
      { error: 'Internal API chưa cấu hình (thiếu INTERNAL_API_KEY phía Zeni-iPO).' },
      { status: 503 },
    )
  }
  if (!provided || !safeEqual(provided, internalKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = req.headers.get('x-user-id') ?? ''
  if (!userId) {
    return NextResponse.json({ error: 'Thiếu x-user-id (uid phiên thật bên gọi)' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const tenantSlug = (searchParams.get('tenant') ?? '').trim()
  const versionParam = (searchParams.get('version') ?? 'active').trim()
  if (!tenantSlug) {
    return NextResponse.json({ error: 'Thiếu tham số tenant' }, { status: 400 })
  }

  let sb
  try {
    sb = createServiceClient()
  } catch {
    return NextResponse.json({ error: 'Chưa cấu hình kết nối dữ liệu phía Zeni-iPO.' }, { status: 503 })
  }

  const { data: tenant } = await sb.from('tenants').select('id, slug, name').eq('slug', tenantSlug).maybeSingle()
  if (!tenant) {
    // Không tiết lộ tenant tồn tại hay không — trả rỗng như trường hợp không có quyền.
    return NextResponse.json({ data: { tenant: tenantSlug, version: null, rows: [], count: 0 } })
  }

  // Giữ nguyên chuỗi RLS: uid phải là thành viên của tenant, nếu không → rỗng.
  const { data: membership } = await sb
    .from('user_profiles')
    .select('id')
    .eq('id', userId)
    .eq('tenant_id', tenant.id)
    .maybeSingle()
  if (!membership) {
    return NextResponse.json({ data: { tenant: tenantSlug, version: null, rows: [], count: 0 } })
  }

  // Chọn version: số cụ thể, hoặc bản published mới nhất khi 'active'.
  let versionQuery = sb
    .from('plan_versions')
    .select('id, version_no, status, published_at, start_period, horizon_months')
    .eq('tenant_id', tenant.id)
    .eq('status', 'published')
  if (versionParam !== 'active') {
    const n = Number(versionParam)
    if (!Number.isInteger(n) || n < 1) {
      return NextResponse.json({ error: 'version phải là số nguyên ≥1 hoặc "active"' }, { status: 400 })
    }
    versionQuery = versionQuery.eq('version_no', n)
  }
  const { data: versions } = await versionQuery.order('version_no', { ascending: false }).limit(1)
  const version = versions?.[0]
  if (!version) {
    return NextResponse.json({ data: { tenant: tenantSlug, version: null, rows: [], count: 0 } })
  }

  const { data: rows, error } = await sb
    .from('plan_targets')
    .select('company_id, period, coa_line, amount, metric_key, scenario')
    .eq('tenant_id', tenant.id)
    .eq('plan_version_id', version.id)
    .order('period', { ascending: true })
    .order('coa_line', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ── Gắn LOẠI BÁO CÁO cho từng mã ──
  // Kế hoạch nay gồm cả ba báo cáo. Dòng 'pnl' là SỐ PHÁT SINH trong tháng
  // (cộng 12 tháng ra số năm); dòng 'bs' là SỐ DƯ CUỐI THÁNG (cộng dồn là vô
  // nghĩa — phải lấy tháng cuối kỳ). Trả mã trần không kèm loại thì bên gọi
  // không có cách nào biết, và sẽ cộng số dư tiền mặt 12 lần.
  const { data: coaRows, error: coaErr } = await sb
    .from('plan_coa_lines')
    .select('code, statement, label_vi')
  if (coaErr) return NextResponse.json({ error: coaErr.message }, { status: 500 })
  const loaiTheoMa = new Map((coaRows ?? []).map((c) => [c.code, c]))

  // Fail-closed: mã không tra được loại thì KHÔNG đoán là 'pnl'. Trả về với
  // statement = null để bên gọi tự chặn, hơn là để nó cộng nhầm.
  const rowsCoLoai = (rows ?? []).map((r) => {
    const coa = r.coa_line ? loaiTheoMa.get(r.coa_line) : undefined
    return {
      ...r,
      statement: coa?.statement ?? null,
      label_vi: coa?.label_vi ?? null,
      /** true = số dư cuối kỳ, CẤM cộng dồn nhiều tháng. */
      is_balance: coa?.statement === 'bs',
    }
  })

  return NextResponse.json({
    data: {
      tenant: tenant.slug,
      tenant_name: tenant.name,
      version: version.version_no,
      published_at: version.published_at,
      start_period: version.start_period,
      horizon_months: version.horizon_months,
      currency: 'VND',
      // Ràng buộc #5: mọi số kèm nhãn nguồn
      source: `plan:v${version.version_no}`,
      // Quy ước đọc số, ghi thẳng vào payload để bên gọi không phải đoán.
      doc_so: {
        pnl: 'số PHÁT SINH trong tháng — cộng 12 tháng ra số năm',
        bs: 'số DƯ cuối tháng — KHÔNG cộng dồn, lấy tháng cuối kỳ',
      },
      rows: rowsCoLoai,
      count: rowsCoLoai.length,
    },
  })
}

const methodNotAllowed = () =>
  NextResponse.json({ error: 'Chỉ hỗ trợ GET' }, { status: 405, headers: { Allow: 'GET' } })

export const POST = methodNotAllowed
export const PUT = methodNotAllowed
export const PATCH = methodNotAllowed
export const DELETE = methodNotAllowed
