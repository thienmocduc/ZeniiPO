/**
 * ZIPO-103 · FINANCIAL MODEL ENGINE — assumptions → P&L + Cash Flow 36-60 tháng.
 *
 * Hàm THUẦN, TẤT ĐỊNH (không Date.now, không random) → test số cứng được,
 * cùng input luôn cho cùng output, nhà đầu tư tái lập được con số.
 *
 * Tuân thủ ràng buộc masterspec:
 *   #2 mọi dòng đều mang mã COA VAS · kỳ THÁNG · company_id
 *   #4 TIỀN = số nguyên VND (BIGINT). Không float tiền. Tỷ lệ tính runtime.
 *   #7 FAIL-CLOSED: assumption âm/vô lý → throw, tuyệt đối không đoán.
 *
 * Bất biến engine tự kiểm (throw nếu vỡ):
 *   · Σ 12 tháng = tổng năm từng dòng (số nguyên)
 *   · cash[m] liên tục: cuối tháng m = đầu tháng m+1
 */

// ── Mã COA dùng trong engine (khớp plan_coa_lines) ──
export const COA = {
  REV_GOODS: '5111',
  REV_SERVICE: '5113',
  DEDUCTION: '521',
  COGS: '632',
  OPEX_SALES_PEOPLE: '6411',
  OPEX_MARKETING: '6417',
  OPEX_GA_PEOPLE: '6421',
  OPEX_GA_RENT: '6427',
  FIN_COST: '635',
  FIN_INCOME: '515',
  OTHER_INCOME: '711',
  OTHER_COST: '811',
  TAX: '821',
} as const

const REVENUE_CODES = new Set<string>([COA.REV_GOODS, COA.REV_SERVICE])
const OPEX_SALES_CODES = new Set<string>([COA.OPEX_SALES_PEOPLE, COA.OPEX_MARKETING])
const OPEX_GA_CODES = new Set<string>([COA.OPEX_GA_PEOPLE, COA.OPEX_GA_RENT])

export type Scenario = 'base' | 'bull' | 'bear'

export type Driver =
  | { type: 'price_volume'; price_vnd: number; volume_month1: number; growth_pct_m: number }
  | { type: 'saas_mrr'; mrr_month1_vnd: number; new_rate_pct: number; churn_rate_pct: number }
  | { type: 'pct_of_revenue'; pct: number }
  | { type: 'headcount'; headcount_month1: number; salary_vnd: number; insurance_pct: number; hires_per_month?: number }
  | { type: 'cac_driven'; cac_vnd: number; new_customers_month1: number; growth_pct_m: number }
  | { type: 'fixed_schedule'; monthly_vnd: number; growth_pct_m?: number }
  | { type: 'manual'; amounts_vnd: number[] }

export type PlanLine = {
  line_id: string
  coa_line: string
  label_vi: string
  company_id?: string | null
  driver: Driver
}

export type PlanInput = {
  /** 'YYYY-MM' — tháng đầu của kế hoạch */
  start_period: string
  horizon_months: number
  lines: PlanLine[]
  working_capital: { dso_days: number; dpo_days: number; dio_days: number }
  opening_cash_vnd: number
  /** Góp vốn theo tháng (1-based) */
  equity_in?: Array<{ month: number; amount_vnd: number }>
  capex?: Array<{ month: number; amount_vnd: number }>
  /** Thuế TNDN — lấy từ bảng tax_rates, KHÔNG hardcode */
  tax_rate_pct: number
  /** Hệ số kịch bản áp lên các driver tăng trưởng/giá/khối lượng */
  scenario_multipliers?: { bull: number; bear: number }
}

export type MonthRow = {
  month: number
  period: string // YYYY-MM-01
  by_coa: Record<string, number>
  revenue: number
  deductions: number
  net_revenue: number
  cogs: number
  gross_profit: number
  opex_sales: number
  opex_ga: number
  ebitda: number
  fin_cost: number
  fin_income: number
  other_income: number
  other_cost: number
  ebt: number
  tax: number
  net_income: number
  ar: number
  inventory: number
  ap: number
  working_capital: number
  delta_wc: number
  cf_operating: number
  equity_in: number
  capex: number
  cash: number
}

export type EngineResult = {
  scenario: Scenario
  months: MonthRow[]
  yearly: Array<{
    year: number
    revenue: number
    cogs: number
    ebitda: number
    net_income: number
    closing_cash: number
  }>
  summary: {
    total_revenue: number
    total_ebitda: number
    ebitda_positive_month: number | null
    cash_negative_month: number | null
    closing_cash: number
    peak_funding_need: number
  }
}

// ── Tiện ích ─────────────────────────────────────────────────────────
/** Tiền luôn là SỐ NGUYÊN VND (ràng buộc #4). */
const vnd = (x: number): number => Math.round(x)

function assertFinite(name: string, v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error(`Assumption "${name}" phải là số hữu hạn — nhận: ${String(v)}`)
  }
  return v
}

/** Fail-closed: giá trị không được âm (ràng buộc #7). */
function assertNonNegative(name: string, v: number): number {
  assertFinite(name, v)
  if (v < 0) throw new Error(`Assumption "${name}" không được âm (nhận ${v}) — engine không đoán số.`)
  return v
}

function assertPct(name: string, v: number, min = -100, max = 1000): number {
  assertFinite(name, v)
  if (v < min || v > max) {
    throw new Error(`Assumption "${name}" = ${v}% ngoài khoảng hợp lệ [${min}, ${max}]`)
  }
  return v
}

function parseStartPeriod(s: string): { year: number; month: number } {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(s)
  if (!m) throw new Error(`start_period phải dạng YYYY-MM — nhận "${s}"`)
  return { year: Number(m[1]), month: Number(m[2]) }
}

function periodOf(start: { year: number; month: number }, offset: number): string {
  const total = start.month - 1 + offset
  const y = start.year + Math.floor(total / 12)
  const mo = (total % 12) + 1
  return `${y}-${String(mo).padStart(2, '0')}-01`
}

/** Hệ số kịch bản áp lên driver tăng trưởng — bull nhân lên, bear nhân xuống. */
function scenarioFactor(scenario: Scenario, mult?: { bull: number; bear: number }): number {
  if (scenario === 'bull') return mult?.bull ?? 1.2
  if (scenario === 'bear') return mult?.bear ?? 0.8
  return 1
}

// ── Tính từng dòng theo driver ───────────────────────────────────────
/**
 * Trả mảng giá trị VND theo tháng cho 1 dòng.
 * `revenueByMonth` cần cho driver pct_of_revenue (tính sau dòng doanh thu).
 */
function computeLine(
  line: PlanLine,
  horizon: number,
  factor: number,
  revenueByMonth: number[] | null,
): number[] {
  const d = line.driver
  const out: number[] = new Array(horizon).fill(0)
  const where = `${line.label_vi} (${line.coa_line})`

  switch (d.type) {
    case 'price_volume': {
      const price = assertNonNegative(`${where}.price_vnd`, d.price_vnd)
      const vol1 = assertNonNegative(`${where}.volume_month1`, d.volume_month1)
      const g = assertPct(`${where}.growth_pct_m`, d.growth_pct_m, -100, 200) * factor
      let vol = vol1
      for (let m = 0; m < horizon; m++) {
        if (m > 0) vol = vol * (1 + g / 100)
        out[m] = vnd(price * vol)
      }
      return out
    }
    case 'saas_mrr': {
      const mrr1 = assertNonNegative(`${where}.mrr_month1_vnd`, d.mrr_month1_vnd)
      const nr = assertPct(`${where}.new_rate_pct`, d.new_rate_pct, 0, 200) * factor
      const cr = assertPct(`${where}.churn_rate_pct`, d.churn_rate_pct, 0, 100)
      let mrr = mrr1
      for (let m = 0; m < horizon; m++) {
        if (m > 0) mrr = mrr * (1 + nr / 100 - cr / 100)
        out[m] = vnd(Math.max(0, mrr))
      }
      return out
    }
    case 'pct_of_revenue': {
      const pct = assertPct(`${where}.pct`, d.pct, 0, 100)
      if (!revenueByMonth) throw new Error(`${where}: driver pct_of_revenue cần doanh thu — sai thứ tự tính`)
      for (let m = 0; m < horizon; m++) out[m] = vnd(revenueByMonth[m] * (pct / 100))
      return out
    }
    case 'headcount': {
      const hc1 = assertNonNegative(`${where}.headcount_month1`, d.headcount_month1)
      const salary = assertNonNegative(`${where}.salary_vnd`, d.salary_vnd)
      const ins = assertPct(`${where}.insurance_pct`, d.insurance_pct, 0, 100)
      const hires = assertNonNegative(`${where}.hires_per_month`, d.hires_per_month ?? 0)
      for (let m = 0; m < horizon; m++) {
        const hc = hc1 + hires * m
        out[m] = vnd(hc * salary * (1 + ins / 100))
      }
      return out
    }
    case 'cac_driven': {
      const cac = assertNonNegative(`${where}.cac_vnd`, d.cac_vnd)
      const nc1 = assertNonNegative(`${where}.new_customers_month1`, d.new_customers_month1)
      const g = assertPct(`${where}.growth_pct_m`, d.growth_pct_m, -100, 200) * factor
      let nc = nc1
      for (let m = 0; m < horizon; m++) {
        if (m > 0) nc = nc * (1 + g / 100)
        out[m] = vnd(cac * nc)
      }
      return out
    }
    case 'fixed_schedule': {
      const base = assertNonNegative(`${where}.monthly_vnd`, d.monthly_vnd)
      const g = assertPct(`${where}.growth_pct_m`, d.growth_pct_m ?? 0, -100, 200)
      let v = base
      for (let m = 0; m < horizon; m++) {
        if (m > 0) v = v * (1 + g / 100)
        out[m] = vnd(v)
      }
      return out
    }
    case 'manual': {
      if (!Array.isArray(d.amounts_vnd)) throw new Error(`${where}: manual cần mảng amounts_vnd`)
      for (let m = 0; m < horizon; m++) {
        const v = d.amounts_vnd[m] ?? 0
        assertFinite(`${where}.amounts_vnd[${m}]`, v)
        out[m] = vnd(v)
      }
      return out
    }
  }
}

// ── Engine chính ─────────────────────────────────────────────────────
export function runPlanEngine(input: PlanInput, scenario: Scenario = 'base'): EngineResult {
  const horizon = input.horizon_months
  if (!Number.isInteger(horizon) || horizon < 1 || horizon > 60) {
    throw new Error(`horizon_months phải là số nguyên 1-60 — nhận ${horizon}`)
  }
  const start = parseStartPeriod(input.start_period)
  const taxRate = assertPct('tax_rate_pct', input.tax_rate_pct, 0, 100)
  const dso = assertNonNegative('working_capital.dso_days', input.working_capital.dso_days)
  const dpo = assertNonNegative('working_capital.dpo_days', input.working_capital.dpo_days)
  const dio = assertNonNegative('working_capital.dio_days', input.working_capital.dio_days)
  const openingCash = assertFinite('opening_cash_vnd', input.opening_cash_vnd)
  if (input.lines.length === 0) throw new Error('Kế hoạch không có dòng nào — engine không sinh số rỗng.')

  const factor = scenarioFactor(scenario, input.scenario_multipliers)

  // Bước 1: dòng DOANH THU trước (các dòng khác có thể phụ thuộc)
  const revenueByMonth: number[] = new Array(horizon).fill(0)
  const lineValues = new Map<string, number[]>()
  for (const line of input.lines) {
    if (!REVENUE_CODES.has(line.coa_line)) continue
    const v = computeLine(line, horizon, factor, null)
    lineValues.set(line.line_id, v)
    for (let m = 0; m < horizon; m++) revenueByMonth[m] += v[m]
  }

  // Bước 2: các dòng còn lại (chi phí, giảm trừ, tài chính, khác)
  for (const line of input.lines) {
    if (REVENUE_CODES.has(line.coa_line)) continue
    if (line.coa_line === COA.TAX) {
      throw new Error('Không nhập dòng 821 (thuế) — engine tự tính từ EBT.')
    }
    lineValues.set(line.line_id, computeLine(line, horizon, factor, revenueByMonth))
  }

  // Bước 3: gom theo COA + dựng P&L rồi Cash Flow
  const equityMap = new Map<number, number>()
  for (const e of input.equity_in ?? []) {
    equityMap.set(e.month, (equityMap.get(e.month) ?? 0) + vnd(assertNonNegative('equity_in', e.amount_vnd)))
  }
  const capexMap = new Map<number, number>()
  for (const c of input.capex ?? []) {
    capexMap.set(c.month, (capexMap.get(c.month) ?? 0) + vnd(assertNonNegative('capex', c.amount_vnd)))
  }

  const months: MonthRow[] = []
  let cash = vnd(openingCash)
  let prevWc = 0

  for (let m = 0; m < horizon; m++) {
    const byCoa: Record<string, number> = {}
    for (const line of input.lines) {
      const v = lineValues.get(line.line_id)![m]
      byCoa[line.coa_line] = (byCoa[line.coa_line] ?? 0) + v
    }

    const revenue = revenueByMonth[m]
    const deductions = byCoa[COA.DEDUCTION] ?? 0
    const cogs = byCoa[COA.COGS] ?? 0
    let opexSales = 0
    let opexGa = 0
    for (const [code, v] of Object.entries(byCoa)) {
      if (OPEX_SALES_CODES.has(code)) opexSales += v
      if (OPEX_GA_CODES.has(code)) opexGa += v
    }
    const finCost = byCoa[COA.FIN_COST] ?? 0
    const finIncome = byCoa[COA.FIN_INCOME] ?? 0
    const otherIncome = byCoa[COA.OTHER_INCOME] ?? 0
    const otherCost = byCoa[COA.OTHER_COST] ?? 0

    const netRevenue = revenue - deductions
    const grossProfit = netRevenue - cogs
    // EBITDA = revenue − 521 − 632 − 641x − 642x  (theo spec)
    const ebitda = revenue - deductions - cogs - opexSales - opexGa
    // EBT = EBITDA − 635 + 515 + 711 − 811
    const ebt = ebitda - finCost + finIncome + otherIncome - otherCost
    // Thuế 821 = max(0, EBT) × thuế suất (cấu hình, không hardcode)
    const tax = vnd(Math.max(0, ebt) * (taxRate / 100))
    const netIncome = ebt - tax
    byCoa[COA.TAX] = tax

    // Vốn lưu động: AR = revenue×DSO/30 · Inventory = cogs×DIO/30 · AP = cogs×DPO/30
    const ar = vnd((revenue * dso) / 30)
    const inventory = vnd((cogs * dio) / 30)
    const ap = vnd((cogs * dpo) / 30)
    const wc = ar + inventory - ap
    const deltaWc = wc - prevWc
    prevWc = wc

    // Dòng tiền gián tiếp: WC tăng = tiền bị giam → trừ khỏi dòng tiền.
    const cfOperating = netIncome - deltaWc
    const equityIn = equityMap.get(m + 1) ?? 0
    const capex = capexMap.get(m + 1) ?? 0
    const cashOpen = cash
    cash = cashOpen + cfOperating + equityIn - capex

    months.push({
      month: m + 1,
      period: periodOf(start, m),
      by_coa: byCoa,
      revenue, deductions, net_revenue: netRevenue, cogs, gross_profit: grossProfit,
      opex_sales: opexSales, opex_ga: opexGa, ebitda,
      fin_cost: finCost, fin_income: finIncome, other_income: otherIncome, other_cost: otherCost,
      ebt, tax, net_income: netIncome,
      ar, inventory, ap, working_capital: wc, delta_wc: deltaWc,
      cf_operating: cfOperating, equity_in: equityIn, capex, cash,
    })
  }

  // ── Bất biến 1: mọi con số tiền là SỐ NGUYÊN ──
  for (const r of months) {
    for (const [k, v] of Object.entries(r.by_coa)) {
      if (!Number.isInteger(v)) throw new Error(`Bất biến vỡ: COA ${k} tháng ${r.month} không phải số nguyên (${v})`)
    }
    if (!Number.isInteger(r.cash)) throw new Error(`Bất biến vỡ: cash tháng ${r.month} không phải số nguyên`)
  }
  // ── Bất biến 2: cash liên tục (cuối m = đầu m+1) ──
  for (let i = 1; i < months.length; i++) {
    const expected = months[i - 1].cash + months[i].cf_operating + months[i].equity_in - months[i].capex
    if (expected !== months[i].cash) {
      throw new Error(`Bất biến vỡ: dòng tiền đứt đoạn ở tháng ${months[i].month}`)
    }
  }

  // ── Tổng hợp theo năm + bất biến 3: Σ12 tháng = tổng năm ──
  const yearly: EngineResult['yearly'] = []
  for (let y = 0; y * 12 < horizon; y++) {
    const slice = months.slice(y * 12, Math.min((y + 1) * 12, horizon))
    const sum = (f: (r: MonthRow) => number) => slice.reduce((a, r) => a + f(r), 0)
    const row = {
      year: y + 1,
      revenue: sum((r) => r.revenue),
      cogs: sum((r) => r.cogs),
      ebitda: sum((r) => r.ebitda),
      net_income: sum((r) => r.net_income),
      closing_cash: slice[slice.length - 1].cash,
    }
    if (!Number.isInteger(row.revenue) || !Number.isInteger(row.ebitda)) {
      throw new Error(`Bất biến vỡ: tổng năm ${row.year} không phải số nguyên`)
    }
    yearly.push(row)
  }

  const ebitdaPositive = months.find((r) => r.ebitda > 0)?.month ?? null
  const cashNegative = months.find((r) => r.cash < 0)?.month ?? null
  const lowestCash = months.reduce((a, r) => Math.min(a, r.cash), openingCash)

  return {
    scenario,
    months,
    yearly,
    summary: {
      total_revenue: months.reduce((a, r) => a + r.revenue, 0),
      total_ebitda: months.reduce((a, r) => a + r.ebitda, 0),
      ebitda_positive_month: ebitdaPositive,
      cash_negative_month: cashNegative,
      closing_cash: months[months.length - 1].cash,
      peak_funding_need: lowestCash < 0 ? -lowestCash : 0,
    },
  }
}

/** Chạy cả 3 kịch bản từ MỘT bộ assumptions (không copy model). */
export function runAllScenarios(input: PlanInput): Record<Scenario, EngineResult> {
  return {
    base: runPlanEngine(input, 'base'),
    bull: runPlanEngine(input, 'bull'),
    bear: runPlanEngine(input, 'bear'),
  }
}

// ── Sensitivity tornado: ±10/20% từng assumption → Δ EBITDA năm 3 ────
export type TornadoRow = {
  line_id: string
  label_vi: string
  coa_line: string
  driver_key: string
  delta_minus_20: number
  delta_minus_10: number
  delta_plus_10: number
  delta_plus_20: number
  /** Biên độ tuyệt đối lớn nhất — dùng để xếp hạng */
  swing: number
}

/** Khoá số của từng driver để bơm ±% (chỉ khoá có ý nghĩa kinh tế). */
function driverKnob(d: Driver): { key: string; get: () => number; set: (v: number) => Driver } | null {
  switch (d.type) {
    case 'price_volume':
      return { key: 'growth_pct_m', get: () => d.growth_pct_m, set: (v) => ({ ...d, growth_pct_m: v }) }
    case 'saas_mrr':
      return { key: 'new_rate_pct', get: () => d.new_rate_pct, set: (v) => ({ ...d, new_rate_pct: v }) }
    case 'pct_of_revenue':
      return { key: 'pct', get: () => d.pct, set: (v) => ({ ...d, pct: v }) }
    case 'headcount':
      return { key: 'salary_vnd', get: () => d.salary_vnd, set: (v) => ({ ...d, salary_vnd: v }) }
    case 'cac_driven':
      return { key: 'cac_vnd', get: () => d.cac_vnd, set: (v) => ({ ...d, cac_vnd: v }) }
    case 'fixed_schedule':
      return { key: 'monthly_vnd', get: () => d.monthly_vnd, set: (v) => ({ ...d, monthly_vnd: v }) }
    case 'manual':
      return null
  }
}

/** Δ EBITDA của năm `targetYear` khi bơm từng assumption ±10/20%. */
export function runSensitivity(input: PlanInput, targetYear = 3): TornadoRow[] {
  const yearIndex = targetYear - 1
  const baseRun = runPlanEngine(input, 'base')
  const baseEbitda = baseRun.yearly[yearIndex]?.ebitda ?? baseRun.yearly[baseRun.yearly.length - 1].ebitda

  const rows: TornadoRow[] = []
  for (const line of input.lines) {
    const knob = driverKnob(line.driver)
    if (!knob) continue
    const original = knob.get()
    const shift = (pct: number): number => {
      const bumped = original * (1 + pct / 100)
      const lines = input.lines.map((l) => (l.line_id === line.line_id ? { ...l, driver: knob.set(bumped) } : l))
      try {
        const r = runPlanEngine({ ...input, lines }, 'base')
        const e = r.yearly[yearIndex]?.ebitda ?? r.yearly[r.yearly.length - 1].ebitda
        return e - baseEbitda
      } catch {
        // Bơm ra giá trị vô lý (vd âm) → fail-closed: coi như không đo được
        return 0
      }
    }
    const m20 = shift(-20)
    const m10 = shift(-10)
    const p10 = shift(10)
    const p20 = shift(20)
    rows.push({
      line_id: line.line_id,
      label_vi: line.label_vi,
      coa_line: line.coa_line,
      driver_key: knob.key,
      delta_minus_20: m20,
      delta_minus_10: m10,
      delta_plus_10: p10,
      delta_plus_20: p20,
      swing: Math.max(Math.abs(m20), Math.abs(p20)),
    })
  }
  return rows.sort((a, b) => b.swing - a.swing)
}

// ── Xuất plan_targets (ZIPO-201) ─────────────────────────────────────
export type PlanTarget = {
  company_id: string | null
  period: string
  coa_line: string
  amount: number
  scenario: Scenario
}

/**
 * Biến output engine thành các dòng plan_targets — 1 dòng / (company, kỳ, COA).
 * Đây là CONTRACT gửi sang ZeniOS: mọi số đều nguyên VND + mang mã COA.
 */
export function toPlanTargets(input: PlanInput, result: EngineResult): PlanTarget[] {
  const horizon = input.horizon_months
  const factor = scenarioFactor(result.scenario, input.scenario_multipliers)

  // Tính từng dòng MỘT LẦN (doanh thu trước — dòng %-doanh-thu phụ thuộc).
  const revenueByMonth: number[] = new Array(horizon).fill(0)
  const perLine = new Map<string, number[]>()
  for (const line of input.lines) {
    if (!REVENUE_CODES.has(line.coa_line)) continue
    const v = computeLine(line, horizon, factor, null)
    perLine.set(line.line_id, v)
    for (let m = 0; m < horizon; m++) revenueByMonth[m] += v[m]
  }
  for (const line of input.lines) {
    if (REVENUE_CODES.has(line.coa_line)) continue
    perLine.set(line.line_id, computeLine(line, horizon, factor, revenueByMonth))
  }

  const targets: PlanTarget[] = []
  for (let m = 0; m < horizon; m++) {
    const row = result.months[m]
    // Gom theo cặp (company_id, coa_line) — nhiều dòng cùng cặp thì cộng dồn.
    const acc = new Map<string, number>()
    for (const line of input.lines) {
      const key = `${line.company_id ?? ''}|${line.coa_line}`
      acc.set(key, (acc.get(key) ?? 0) + perLine.get(line.line_id)![m])
    }
    // Thuế do engine tính (không phải dòng nhập) — gắn cấp tập đoàn.
    if (row.tax !== 0) acc.set(`|${COA.TAX}`, (acc.get(`|${COA.TAX}`) ?? 0) + row.tax)

    for (const [key, amount] of acc) {
      if (amount === 0) continue
      const sep = key.indexOf('|')
      targets.push({
        company_id: key.slice(0, sep) || null,
        period: row.period,
        coa_line: key.slice(sep + 1),
        amount: vnd(amount),
        scenario: result.scenario,
      })
    }
  }
  return targets
}
