/**
 * Valuation engine — 3 phương pháp chuẩn tài chính doanh nghiệp (MBA core).
 *
 *  1. Comparables (Market approach) — bội số của công ty cùng ngành.
 *     Banker dùng đầu tiên vì phản ánh giá thị trường ĐANG trả.
 *  2. DCF (Income approach) — chiết khấu dòng tiền tự do về hiện tại + giá trị
 *     cuối kỳ theo Gordon Growth. Chuẩn học thuật, nhạy với WACC/g.
 *  3. VC Method — quỹ mạo hiểm dùng: từ giá trị thoái vốn kỳ vọng chiết khấu
 *     ngược theo tỷ suất mục tiêu để ra pre/post-money hôm nay.
 *
 * Mọi hàm thuần (pure) để test được và chạy cả server lẫn client.
 */

export type Comparable = {
  company_name: string
  ev_revenue_multiple?: number | null
  ev_ebitda_multiple?: number | null
  pe_ratio?: number | null
}

export const median = (xs: number[]): number | null => {
  const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b)
  if (v.length === 0) return null
  const mid = Math.floor(v.length / 2)
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2
}

export type ComparablesInput = {
  revenue: number
  ebitda?: number
  net_income?: number
  net_debt?: number
  comparables: Comparable[]
  /** Chiết khấu thanh khoản cho công ty tư nhân (mặc định 25% — chuẩn thực hành). */
  illiquidity_discount_pct?: number
}

export function valuateComparables(inp: ComparablesInput) {
  const evRev = median(inp.comparables.map((c) => Number(c.ev_revenue_multiple)).filter(Number.isFinite))
  const evEbitda = median(inp.comparables.map((c) => Number(c.ev_ebitda_multiple)).filter(Number.isFinite))
  const pe = median(inp.comparables.map((c) => Number(c.pe_ratio)).filter(Number.isFinite))

  const byRevenue = evRev != null ? inp.revenue * evRev : null
  const byEbitda = evEbitda != null && inp.ebitda != null && inp.ebitda > 0 ? inp.ebitda * evEbitda : null
  const byEarnings = pe != null && inp.net_income != null && inp.net_income > 0 ? inp.net_income * pe : null

  const candidates = [byRevenue, byEbitda].filter((x): x is number => x != null && x > 0)
  const evRaw = candidates.length ? candidates.reduce((a, b) => a + b, 0) / candidates.length : null

  const disc = (inp.illiquidity_discount_pct ?? 25) / 100
  const ev = evRaw != null ? evRaw * (1 - disc) : null
  const equity = ev != null ? ev - (inp.net_debt ?? 0) : null

  return {
    method: 'comparables' as const,
    multiples_used: { ev_revenue: evRev, ev_ebitda: evEbitda, pe },
    ev_by_revenue: byRevenue,
    ev_by_ebitda: byEbitda,
    equity_by_pe: byEarnings,
    illiquidity_discount_pct: inp.illiquidity_discount_pct ?? 25,
    enterprise_value: ev,
    equity_value: equity,
    peer_count: inp.comparables.length,
  }
}

export type DcfInput = {
  /** FCF năm 1 (nếu không có, ước từ EBITDA × (1 − thuế) − capex). */
  fcf_year1: number
  growth_rate_pct: number
  years: number
  wacc_pct: number
  terminal_growth_pct: number
  net_debt?: number
}

export function valuateDcf(inp: DcfInput) {
  const wacc = inp.wacc_pct / 100
  const g = inp.growth_rate_pct / 100
  const tg = inp.terminal_growth_pct / 100
  const n = Math.max(1, Math.min(20, Math.round(inp.years)))

  if (wacc <= tg) {
    return {
      method: 'dcf' as const,
      error: 'WACC phải LỚN HƠN tăng trưởng vĩnh viễn (g) — nếu không mô hình Gordon vô nghĩa.',
      enterprise_value: null,
      equity_value: null,
    }
  }

  const flows: Array<{ year: number; fcf: number; discounted: number }> = []
  let pv = 0
  let fcf = inp.fcf_year1
  for (let y = 1; y <= n; y++) {
    if (y > 1) fcf = fcf * (1 + g)
    const d = fcf / Math.pow(1 + wacc, y)
    pv += d
    flows.push({ year: y, fcf: Math.round(fcf), discounted: Math.round(d) })
  }
  const terminalFcf = fcf * (1 + tg)
  const terminalValue = terminalFcf / (wacc - tg)
  const pvTerminal = terminalValue / Math.pow(1 + wacc, n)
  const ev = pv + pvTerminal

  return {
    method: 'dcf' as const,
    flows,
    pv_explicit: Math.round(pv),
    terminal_value: Math.round(terminalValue),
    pv_terminal: Math.round(pvTerminal),
    terminal_pct_of_ev: ev > 0 ? Math.round((pvTerminal / ev) * 100) : null,
    enterprise_value: Math.round(ev),
    equity_value: Math.round(ev - (inp.net_debt ?? 0)),
    assumptions: { wacc_pct: inp.wacc_pct, growth_rate_pct: inp.growth_rate_pct, terminal_growth_pct: inp.terminal_growth_pct, years: n },
  }
}

export type VcMethodInput = {
  exit_revenue: number
  exit_multiple: number
  years_to_exit: number
  target_irr_pct: number
  investment_usd: number
  /** Pha loãng dự kiến các vòng sau (mặc định 25%). */
  future_dilution_pct?: number
}

export function valuateVcMethod(inp: VcMethodInput) {
  const exitValue = inp.exit_revenue * inp.exit_multiple
  const irr = inp.target_irr_pct / 100
  const yrs = Math.max(1, Math.min(15, inp.years_to_exit))
  const postMoney = exitValue / Math.pow(1 + irr, yrs)
  const preMoney = postMoney - inp.investment_usd
  const ownershipRequired = postMoney > 0 ? (inp.investment_usd / postMoney) * 100 : null
  const dilution = (inp.future_dilution_pct ?? 25) / 100
  const ownershipAdjusted = ownershipRequired != null ? ownershipRequired / (1 - dilution) : null

  return {
    method: 'vc_method' as const,
    exit_value: Math.round(exitValue),
    post_money: Math.round(postMoney),
    pre_money: Math.round(preMoney),
    ownership_required_pct: ownershipRequired != null ? Math.round(ownershipRequired * 10) / 10 : null,
    ownership_adjusted_for_dilution_pct: ownershipAdjusted != null ? Math.round(ownershipAdjusted * 10) / 10 : null,
    enterprise_value: Math.round(postMoney),
    equity_value: Math.round(preMoney),
    assumptions: { ...inp, future_dilution_pct: inp.future_dilution_pct ?? 25 },
  }
}
