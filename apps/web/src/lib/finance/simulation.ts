/**
 * Engine GIẢ LẬP ĐIỀU HÀNH — dựng một công ty quy mô lớn để tập điều hành.
 *
 * Mô hình driver-based (chuẩn lập kế hoạch tài chính doanh nghiệp):
 *   khách hàng → doanh thu → giá vốn → chi phí vận hành → EBITDA → tiền mặt
 * Có churn, tuyển người theo doanh thu/nhân sự, gọi vốn khi tiền chạm đáy.
 *
 * Thuần & tất định (không random) → cùng giả định cho cùng kết quả, so sánh
 * kịch bản được. Dùng cho chế độ `simulation` lẫn dự báo của công ty thật.
 */

export type SimAssumptions = {
  /** Tăng trưởng khách mới mỗi tháng, % */
  new_customer_growth_pct: number
  /** Số khách mới tháng đầu */
  new_customers_month1: number
  /** Doanh thu bình quân mỗi khách mỗi tháng */
  arpu: number
  /** Rời bỏ mỗi tháng, % */
  churn_pct: number
  /** Biên gộp, % */
  gross_margin_pct: number
  /** Chi phí cố định tháng đầu */
  fixed_opex_month1: number
  /** Chi phí cố định tăng mỗi tháng, % */
  opex_growth_pct: number
  /** Chi phí bán hàng & marketing trên mỗi khách mới (CAC) */
  cac: number
  /** Doanh thu/năm mỗi nhân sự (dùng để suy số người cần) */
  revenue_per_employee_year: number
  /** Lương bình quân tháng mỗi nhân sự */
  salary_per_employee_month: number
  /** Tiền mặt ban đầu */
  starting_cash: number
  /** Ngưỡng tiền tối thiểu — chạm là kích hoạt gọi vốn */
  min_cash_floor: number
  /** Số tiền mỗi lần gọi vốn */
  funding_round_size: number
}

export type SimMonth = {
  month: number
  customers: number
  new_customers: number
  churned_customers: number
  revenue: number
  cogs: number
  gross_profit: number
  sm_spend: number
  payroll: number
  fixed_opex: number
  ebitda: number
  cash: number
  headcount: number
  funding_raised: number
}

export type SimResult = {
  months: SimMonth[]
  summary: {
    final_customers: number
    final_mrr: number
    final_arr: number
    peak_headcount: number
    total_funding: number
    months_to_breakeven: number | null
    lowest_cash: number
    ran_out_of_cash_month: number | null
    ltv: number | null
    ltv_cac: number | null
    cac_payback_months: number | null
  }
}

export function runSimulation(a: SimAssumptions, months: number): SimResult {
  const n = Math.max(1, Math.min(120, Math.round(months)))
  const out: SimMonth[] = []

  let customers = 0
  let cash = a.starting_cash
  let newCust = Math.max(0, a.new_customers_month1)
  let fixedOpex = Math.max(0, a.fixed_opex_month1)
  let totalFunding = 0
  let breakeven: number | null = null
  let lowestCash = a.starting_cash
  let ranOut: number | null = null
  let peakHeadcount = 0

  for (let m = 1; m <= n; m++) {
    const churned = Math.round(customers * (a.churn_pct / 100))
    customers = Math.max(0, customers - churned + Math.round(newCust))

    const revenue = customers * a.arpu
    const cogs = revenue * (1 - a.gross_margin_pct / 100)
    const grossProfit = revenue - cogs

    // Nhân sự suy từ doanh thu năm hoá / năng suất mỗi người (tối thiểu 1)
    const headcount = Math.max(
      1,
      Math.ceil((revenue * 12) / Math.max(1, a.revenue_per_employee_year)),
    )
    peakHeadcount = Math.max(peakHeadcount, headcount)
    const payroll = headcount * a.salary_per_employee_month
    const smSpend = Math.round(newCust) * a.cac

    const ebitda = grossProfit - payroll - fixedOpex - smSpend
    cash += ebitda

    // Gọi vốn khi tiền chạm sàn (mô phỏng quyết định tài chính thật)
    let raised = 0
    if (cash < a.min_cash_floor && a.funding_round_size > 0) {
      raised = a.funding_round_size
      cash += raised
      totalFunding += raised
    }

    if (breakeven == null && ebitda >= 0 && revenue > 0) breakeven = m
    lowestCash = Math.min(lowestCash, cash)
    if (ranOut == null && cash < 0) ranOut = m

    out.push({
      month: m,
      customers,
      new_customers: Math.round(newCust),
      churned_customers: churned,
      revenue: Math.round(revenue),
      cogs: Math.round(cogs),
      gross_profit: Math.round(grossProfit),
      sm_spend: Math.round(smSpend),
      payroll: Math.round(payroll),
      fixed_opex: Math.round(fixedOpex),
      ebitda: Math.round(ebitda),
      cash: Math.round(cash),
      headcount,
      funding_raised: raised,
    })

    newCust = newCust * (1 + a.new_customer_growth_pct / 100)
    fixedOpex = fixedOpex * (1 + a.opex_growth_pct / 100)
  }

  const last = out[out.length - 1]
  // LTV = ARPU × GM% ÷ churn (công thức kinh điển)
  const ltv =
    a.churn_pct > 0 ? (a.arpu * (a.gross_margin_pct / 100)) / (a.churn_pct / 100) : null
  const ltvCac = ltv != null && a.cac > 0 ? Math.round((ltv / a.cac) * 100) / 100 : null
  const payback =
    a.arpu * a.gross_margin_pct > 0
      ? Math.round((a.cac / (a.arpu * (a.gross_margin_pct / 100))) * 10) / 10
      : null

  return {
    months: out,
    summary: {
      final_customers: last.customers,
      final_mrr: last.revenue,
      final_arr: last.revenue * 12,
      peak_headcount: peakHeadcount,
      total_funding: totalFunding,
      months_to_breakeven: breakeven,
      lowest_cash: Math.round(lowestCash),
      ran_out_of_cash_month: ranOut,
      ltv: ltv != null ? Math.round(ltv) : null,
      ltv_cac: ltvCac,
      cac_payback_months: payback,
    },
  }
}
