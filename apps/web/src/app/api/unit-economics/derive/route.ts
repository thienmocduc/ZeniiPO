import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/unit-economics/derive — chạy toàn bộ công thức MBA rồi CHẤM ĐIỂM
 * doanh nghiệp so chuẩn ngành theo giai đoạn.
 *
 * 1. RPC derive_unit_economics → 16 KPI (CAC/LTV/LTV:CAC/Payback/NRR/GRR/
 *    Quick Ratio/ARR/Rule of 40/Burn Multiple/Magic Number…) ghi kpi_metrics.
 * 2. RPC grade_vs_benchmark(stage) → so từng chỉ số với ipo_benchmarks
 *    (thư viện chuẩn VC/banker) → pass/fail + gợi ý hành động.
 *
 * Stage suy từ round gần nhất nếu client không truyền.
 */

const StageSchema = z.enum(['seed', 'series_a', 'series_b', 'growth', 'pre_ipo'])
type Stage = z.infer<typeof StageSchema>

const BodySchema = z.object({ stage: StageSchema.optional() })

const ROUND_TO_STAGE: Record<string, Stage> = {
  pre_seed: 'seed', angel: 'seed', seed: 'seed',
  series_a: 'series_a', series_b: 'series_b',
  series_c: 'growth', series_d: 'growth', bridge: 'growth',
  pre_ipo: 'pre_ipo', ipo: 'pre_ipo',
}

/** Gợi ý hành động cho từng chỉ số fail — tri thức MBA rút gọn. */
const FIX_HINT: Record<string, string> = {
  ltv_cac_ratio: 'Tăng LTV (giá/upsell/giữ chân) hoặc giảm CAC (kênh rẻ hơn, tỷ lệ chuyển đổi cao hơn).',
  cac_payback_months: 'Rút ngắn payback: thu tiền trước (annual prepay), nâng giá, hoặc cắt kênh CAC đắt.',
  gross_margin_pct: 'Soát COGS: hạ chi phí hạ tầng/nhân sự phục vụ, nâng giá, bỏ gói lỗ biên.',
  nrr_pct: 'Xây upsell/cross-sell + giảm downgrade; NRR là đòn bẩy định giá mạnh nhất.',
  grr_pct: 'Churn gốc quá cao — sửa onboarding, chất lượng sản phẩm, customer success.',
  rule_of_40: 'Chọn: tăng trưởng nhanh hơn HOẶC cải thiện biên EBITDA. Tổng phải ≥40.',
  burn_multiple: 'Đốt quá nhiều cho mỗi $1 ARR mới — cắt chi tiêu kém hiệu quả, tập trung kênh ROI cao.',
  magic_number: 'Hiệu suất bán hàng thấp — chưa nên đạp ga S&M, sửa quy trình bán trước.',
  quick_ratio: 'Tăng trưởng bị churn ăn mòn — ưu tiên giữ chân trước khi mở rộng.',
  runway_months: 'Runway mỏng: cắt burn hoặc khởi động gọi vốn ngay (cần 6-9 tháng chuẩn bị).',
  ccc_days: 'Tiền đọng: rút ngắn DSO (thu nhanh), giảm tồn kho, đàm phán kéo dài DPO.',
  readiness_score: 'Hoàn thiện checklist IPO readiness — tài chính, quản trị, pháp lý, data room.',
}

export async function POST(req: Request) {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // 1 · Công thức MBA từ dữ liệu thật.
  const ue = await supabase.rpc('derive_unit_economics', { p_tenant: auth.tenantId })
  if (ue.error) return NextResponse.json({ error: ue.error.message }, { status: 500 })
  const metrics = ue.data as { ok: boolean; error?: string }
  if (!metrics?.ok) return NextResponse.json({ error: metrics?.error ?? 'derive failed' }, { status: 422 })

  // 2 · Stage: client truyền, hoặc suy từ round mới nhất.
  let stage = parsed.data.stage
  if (!stage) {
    const { data: rounds } = await supabase
      .from('fundraise_rounds')
      .select('round_code, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
    stage = ROUND_TO_STAGE[String(rounds?.[0]?.round_code ?? '')] ?? 'seed'
  }

  // 3 · Chấm so chuẩn ngành.
  const grade = await supabase.rpc('grade_vs_benchmark', { p_tenant: auth.tenantId, p_stage: stage })
  if (grade.error) return NextResponse.json({ error: grade.error.message }, { status: 500 })
  const g = grade.data as {
    stage: string
    passed: number
    measured: number
    score_pct: number
    items: Array<{ metric_code: string; name: string; category: string; actual: number | null; status: string; target: string; note: string }>
  }

  const items = (g.items ?? []).map((it) => ({
    ...it,
    fix_hint: it.status === 'fail' ? (FIX_HINT[it.metric_code] ?? null) : null,
  }))

  return NextResponse.json({
    data: {
      metrics,
      benchmark: { stage: g.stage, passed: g.passed, measured: g.measured, score_pct: g.score_pct, items },
    },
  })
}
