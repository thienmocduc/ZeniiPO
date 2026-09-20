import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'
import { safeUuid } from '@/lib/security/schemas'
import { kiemBanNhap } from '@/lib/plan/gac-ban-nhap'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GIẢ ĐỊNH KẾ HOẠCH — vốn ban đầu, vòng quay vốn lưu động, hệ số kịch bản.
 *
 * `buildPlanInput` đọc những khoá này để dựng đầu vào cho engine, nhưng trước
 * tệp này KHÔNG có đường nào ghi chúng — nên mọi kế hoạch đều chạy với tiền
 * mặt đầu kỳ = 0 và vòng quay = 0. Một kế hoạch bắt đầu với 0 đồng thì tháng
 * nào cũng âm tiền, và người dùng không hiểu vì sao.
 *
 * ⚠ KHOÁ ĐÓNG, KHÔNG NHẬN KHOÁ TỰ ĐẶT. Engine chỉ đọc đúng những khoá dưới
 * đây; cho phép gõ khoá tuỳ ý thì người dùng khai `opening_cash` (thiếu hậu tố
 * `_vnd`), engine không thấy, và họ ngồi tìm mãi không ra vì sao số không đổi.
 * Gõ sai khoá phải BÁO LỖI ngay tại cửa vào.
 */

/** Đúng những khoá `buildPlanInput` đọc. Thêm khoá ở đây phải sửa cả bên đó. */
const KHOA = {
  opening_cash_vnd: { nhan: 'Tiền mặt đầu kỳ', donVi: 'VND', min: 0, max: 1e15 },
  dso_days: { nhan: 'Số ngày thu tiền bình quân', donVi: 'ngày', min: 0, max: 365 },
  dpo_days: { nhan: 'Số ngày trả tiền bình quân', donVi: 'ngày', min: 0, max: 365 },
  dio_days: { nhan: 'Số ngày tồn kho bình quân', donVi: 'ngày', min: 0, max: 365 },
  tax_rate_pct: { nhan: 'Thuế suất TNDN (nếu muốn đè bảng thuế)', donVi: '%', min: 0, max: 100 },
  scenario_bull_multiplier: { nhan: 'Hệ số kịch bản tốt', donVi: 'lần', min: 1, max: 5 },
  scenario_bear_multiplier: { nhan: 'Hệ số kịch bản xấu', donVi: 'lần', min: 0.1, max: 1 },
  depreciation_years: { nhan: 'Số năm khấu hao tài sản cố định', donVi: 'năm', min: 1, max: 50 },
  opening_equity_vnd: { nhan: 'Vốn chủ sở hữu đầu kỳ', donVi: 'VND', min: 0, max: 1e15 },
} as const

type KhoaHopLe = keyof typeof KHOA

/** GET — giả định hiện có + danh mục khoá hợp lệ để giao diện dựng biểu mẫu. */
export async function GET(req: Request) {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const versionId = new URL(req.url).searchParams.get('version_id') ?? ''
  if (!safeUuid.safeParse(versionId).success) {
    return NextResponse.json({ error: 'Thiếu hoặc sai tham số version_id' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('plan_assumptions')
    .select('key, label_vi, unit, value_base, value_bull, value_bear')
    .eq('plan_version_id', versionId)
    .order('key')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    data: {
      assumptions: data ?? [],
      danh_muc: Object.entries(KHOA).map(([key, v]) => ({ key, ...v })),
    },
  })
}

const PutSchema = z.object({
  plan_version_id: safeUuid,
  key: z.enum(Object.keys(KHOA) as [KhoaHopLe, ...KhoaHopLe[]]),
  value_base: z.number().finite(),
  value_bull: z.number().finite().optional(),
  value_bear: z.number().finite().optional(),
})

export async function PUT(req: Request) {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const parsed = PutSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.flatten(),
        goi_y: `Khoá hợp lệ: ${Object.keys(KHOA).join(', ')}`,
      },
      { status: 400 },
    )
  }

  const gac = await kiemBanNhap(supabase, parsed.data.plan_version_id)
  if (!gac.ok) return NextResponse.json({ error: gac.message }, { status: gac.status })

  const dinhNghia = KHOA[parsed.data.key]
  if (parsed.data.value_base < dinhNghia.min || parsed.data.value_base > dinhNghia.max) {
    return NextResponse.json(
      {
        error:
          `"${dinhNghia.nhan}" phải nằm trong khoảng ${dinhNghia.min}–${dinhNghia.max} ${dinhNghia.donVi}. ` +
          `Nhận ${parsed.data.value_base}.`,
      },
      { status: 422 },
    )
  }

  const { data, error } = await supabase
    .from('plan_assumptions')
    .upsert(
      {
        tenant_id: auth.tenantId,
        plan_version_id: parsed.data.plan_version_id,
        key: parsed.data.key,
        label_vi: dinhNghia.nhan,
        unit: dinhNghia.donVi,
        value_base: parsed.data.value_base,
        value_bull: parsed.data.value_bull ?? null,
        value_bear: parsed.data.value_bear ?? null,
      },
      { onConflict: 'plan_version_id,key' },
    )
    .select('key, label_vi, unit, value_base')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
