import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/financials/derive — "HÀM KHỚP" của Business Spine.
 *
 * 1. Chạy RPC derive_finance_kpis: P&L tháng → 11 KPI tài chính
 *    (revenue/growth/GM/EBITDA/burn/cash/runway/DSO/DIO/DPO/CCC) ghi vào
 *    kpi_metrics (category 'finance_derived') — mọi dashboard đọc KPI sẽ
 *    tự khớp với bảng tài chính, KHÔNG nhập tay 2 nơi.
 * 2. Đối chiếu CHIẾN LƯỢC GỌI VỐN với nhu cầu tiền theo hàm:
 *      cash_need = burn_avg_3m × (runway_floor + raise_buffer) − cash
 *      so với tổng target các round đang mở (fundraise_rounds status
 *      planning→due_diligence) → mismatches nếu lệch.
 * 3. Trả reconciliation report cho UI (P&L page + Cockpit).
 */

type Mismatch = { code: string; severity: 'info' | 'warn' | 'critical'; message: string }

export async function POST() {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  // 1 · Hàm dẫn xuất KPI từ statements (RLS áp trong session user).
  const rpc = await supabase.rpc('derive_finance_kpis', { p_tenant: auth.tenantId })
  if (rpc.error) return NextResponse.json({ error: rpc.error.message }, { status: 500 })
  const fin = rpc.data as {
    ok: boolean
    error?: string
    period?: string
    revenue?: number
    gross_margin_pct?: number
    ebitda?: number
    net_burn?: number
    burn_avg_3m?: number
    cash_balance?: number | null
    runway_months?: number | null
    growth_mom_pct?: number | null
    ccc_days?: number
    dso?: number
    dio?: number
    dpo?: number
  }
  if (!fin?.ok) return NextResponse.json({ error: fin?.error ?? 'derive failed' }, { status: 422 })

  // 2 · Assumptions (mặc định chuẩn IPO-MBA nếu tenant chưa set).
  const { data: assum } = await supabase.from('finance_assumptions').select('key, value')
  const A = new Map<string, number>((assum ?? []).map((a) => [a.key as string, Number(a.value)]))
  const runwayFloor = A.get('runway_floor_months') ?? 9
  const raiseBuffer = A.get('raise_buffer_months') ?? 9
  const targetGm = A.get('target_gm_pct') ?? 40
  const cccMax = A.get('ccc_max_days') ?? 60

  // 3 · Round đang mở → đối chiếu với nhu cầu tiền theo hàm.
  const OPEN = ['planning', 'outreach', 'negotiating', 'term_sheet', 'due_diligence']
  const { data: rounds } = await supabase
    .from('fundraise_rounds')
    .select('id, round_name, round_code, target_raise_usd, actual_raise_usd, status, target_close_date')
  const openRounds = (rounds ?? []).filter((r) => OPEN.includes(r.status as string))
  const openTarget = openRounds.reduce((a, r) => a + Number(r.target_raise_usd ?? 0), 0)

  const burn = fin.burn_avg_3m ?? fin.net_burn ?? 0
  const cash = fin.cash_balance ?? 0
  const cashNeed = burn > 0 ? Math.max(0, burn * (runwayFloor + raiseBuffer) - cash) : 0

  const mismatches: Mismatch[] = []
  if (fin.runway_months != null && fin.runway_months < runwayFloor && openTarget === 0 && cashNeed > 0) {
    mismatches.push({
      code: 'runway_no_round',
      severity: fin.runway_months < 6 ? 'critical' : 'warn',
      message: `Runway ${fin.runway_months} tháng < sàn ${runwayFloor} tháng nhưng CHƯA có round nào mở. Cần mở round ~$${Math.round(cashNeed).toLocaleString()}.`,
    })
  }
  if (openTarget > 0 && cashNeed > 0 && openTarget < cashNeed * 0.8) {
    mismatches.push({
      code: 'round_undersized',
      severity: 'warn',
      message: `Round đang mở ($${openTarget.toLocaleString()}) NHỎ hơn nhu cầu tiền theo hàm ($${Math.round(cashNeed).toLocaleString()} cho ${runwayFloor + raiseBuffer} tháng). Cân nhắc nâng target.`,
    })
  }
  if (openTarget > 0 && cashNeed > 0 && openTarget > cashNeed * 2.5) {
    mismatches.push({
      code: 'round_oversized',
      severity: 'info',
      message: `Round đang mở ($${openTarget.toLocaleString()}) LỚN hơn 2.5× nhu cầu theo hàm — pha loãng không cần thiết?`,
    })
  }
  if ((fin.gross_margin_pct ?? 0) < targetGm && (fin.revenue ?? 0) > 0) {
    mismatches.push({
      code: 'gm_below_target',
      severity: 'warn',
      message: `Gross margin ${fin.gross_margin_pct}% < mục tiêu ${targetGm}% — soát COGS/pricing.`,
    })
  }
  if ((fin.ccc_days ?? 0) > cccMax) {
    mismatches.push({
      code: 'ccc_slow',
      severity: 'warn',
      message: `CCC ${fin.ccc_days} ngày > ngưỡng ${cccMax} — tiền đọng ở AR/tồn kho (DSO ${fin.dso} · DIO ${fin.dio} · DPO ${fin.dpo}).`,
    })
  }

  return NextResponse.json({
    data: {
      financial: fin,
      funding: {
        burn_avg_3m: burn,
        cash_balance: cash,
        runway_months: fin.runway_months,
        runway_floor_months: runwayFloor,
        cash_need_usd: Math.round(cashNeed),
        open_rounds: openRounds.map((r) => ({
          round_name: r.round_name,
          status: r.status,
          target_raise_usd: r.target_raise_usd,
        })),
        open_target_usd: openTarget,
      },
      kpis_updated: 11,
      mismatches,
    },
  })
}
