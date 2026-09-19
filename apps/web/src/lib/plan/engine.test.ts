/**
 * ZIPO-103 — TEST SỐ CỨNG CHO ENGINE MÔ HÌNH TÀI CHÍNH
 *
 * Masterspec đòi ≥12 test số cứng (`docs/TICKETS_BRAIN_V1.md`), và ràng buộc #8
 * ghi rõ: test acceptance LÀ điều kiện hoàn thành — thiếu bằng chứng = chưa xong.
 *
 * Vì sao phải là SỐ CỨNG (tự tay tính, viết thẳng con số kỳ vọng) chứ không
 * phải so lại kết quả của chính engine: nếu engine tính sai, test kiểu "so với
 * chính nó" vẫn xanh. Mọi con số dưới đây tính tay từ giả định, độc lập với mã.
 *
 * Engine là hàm THUẦN → chạy được không cần database (đang chờ phiếu #8).
 */
import { describe, expect, it } from 'vitest'
import {
  COA,
  runPlanEngine,
  runAllScenarios,
  runSensitivity,
  toPlanTargets,
  type PlanInput,
} from './engine'

/** Kế hoạch tối giản: 1 dòng doanh thu cố định, không chi phí — dễ tính tay. */
function basePlan(over: Partial<PlanInput> = {}): PlanInput {
  return {
    start_period: '2026-01',
    horizon_months: 12,
    lines: [
      {
        line_id: 'rev',
        coa_line: COA.REV_GOODS,
        label_vi: 'Doanh thu bán hàng',
        driver: { type: 'fixed_schedule', monthly_vnd: 100_000_000 },
      },
    ],
    working_capital: { dso_days: 0, dpo_days: 0, dio_days: 0 },
    opening_cash_vnd: 0,
    tax_rate_pct: 20,
    ...over,
  }
}

describe('ZIPO-103 · doanh thu theo driver', () => {
  it('1. fixed_schedule: 100tr/tháng × 12 tháng = 1,2 tỷ doanh thu năm', () => {
    const r = runPlanEngine(basePlan())
    expect(r.months).toHaveLength(12)
    expect(r.months[0].revenue).toBe(100_000_000)
    expect(r.summary.total_revenue).toBe(1_200_000_000)
  })

  it('2. price_volume: 50.000đ × 200 sp, tăng 10%/tháng → tháng 2 đúng 11.000.000đ', () => {
    const r = runPlanEngine(
      basePlan({
        lines: [
          {
            line_id: 'rev',
            coa_line: COA.REV_GOODS,
            label_vi: 'Bán hàng',
            driver: { type: 'price_volume', price_vnd: 50_000, volume_month1: 200, growth_pct_m: 10 },
          },
        ],
      }),
    )
    // tháng 1 = 50.000 × 200 = 10.000.000 · tháng 2 = ×1,1 = 11.000.000
    expect(r.months[0].revenue).toBe(10_000_000)
    expect(r.months[1].revenue).toBe(11_000_000)
  })

  it('3. saas_mrr: 100tr, +20% mới, −5% rời bỏ → tháng 2 = 115.000.000đ', () => {
    const r = runPlanEngine(
      basePlan({
        lines: [
          {
            line_id: 'mrr',
            coa_line: COA.REV_SERVICE,
            label_vi: 'Thuê bao',
            driver: { type: 'saas_mrr', mrr_month1_vnd: 100_000_000, new_rate_pct: 20, churn_rate_pct: 5 },
          },
        ],
      }),
    )
    // 100tr × (1 + 0,20 − 0,05) = 115tr
    expect(r.months[0].revenue).toBe(100_000_000)
    expect(r.months[1].revenue).toBe(115_000_000)
  })

  it('4. headcount: 5 người × 20tr lương × (1 + 21,5% bảo hiểm) = 121.500.000đ/tháng', () => {
    const r = runPlanEngine(
      basePlan({
        lines: [
          {
            line_id: 'people',
            coa_line: COA.OPEX_GA_PEOPLE,
            label_vi: 'Lương quản lý',
            driver: { type: 'headcount', headcount_month1: 5, salary_vnd: 20_000_000, insurance_pct: 21.5 },
          },
        ],
      }),
    )
    expect(r.months[0].opex_ga).toBe(121_500_000)
  })
})

describe('ZIPO-103 · chuỗi tính kết quả kinh doanh', () => {
  it('5. EBITDA = doanh thu − giảm trừ − giá vốn − chi phí bán hàng − chi phí quản lý', () => {
    const r = runPlanEngine(
      basePlan({
        lines: [
          { line_id: 'rev', coa_line: COA.REV_GOODS, label_vi: 'DT', driver: { type: 'fixed_schedule', monthly_vnd: 100_000_000 } },
          { line_id: 'ded', coa_line: COA.DEDUCTION, label_vi: 'Giảm trừ', driver: { type: 'fixed_schedule', monthly_vnd: 5_000_000 } },
          { line_id: 'cogs', coa_line: COA.COGS, label_vi: 'Giá vốn', driver: { type: 'pct_of_revenue', pct: 40 } },
          { line_id: 'mkt', coa_line: COA.OPEX_MARKETING, label_vi: 'Marketing', driver: { type: 'fixed_schedule', monthly_vnd: 10_000_000 } },
          { line_id: 'rent', coa_line: COA.OPEX_GA_RENT, label_vi: 'Thuê VP', driver: { type: 'fixed_schedule', monthly_vnd: 15_000_000 } },
        ],
      }),
    )
    const m = r.months[0]
    // giá vốn = 40% × 100tr = 40tr (tính trên doanh thu gộp)
    expect(m.cogs).toBe(40_000_000)
    // EBITDA = 100 − 5 − 40 − 10 − 15 = 30tr
    expect(m.ebitda).toBe(30_000_000)
  })

  it('6. EBT = EBITDA − chi phí tài chính + doanh thu tài chính + thu nhập khác − chi phí khác', () => {
    const r = runPlanEngine(
      basePlan({
        lines: [
          { line_id: 'rev', coa_line: COA.REV_GOODS, label_vi: 'DT', driver: { type: 'fixed_schedule', monthly_vnd: 100_000_000 } },
          { line_id: 'fc', coa_line: COA.FIN_COST, label_vi: 'Lãi vay', driver: { type: 'fixed_schedule', monthly_vnd: 8_000_000 } },
          { line_id: 'fi', coa_line: COA.FIN_INCOME, label_vi: 'Lãi tiền gửi', driver: { type: 'fixed_schedule', monthly_vnd: 3_000_000 } },
          { line_id: 'oi', coa_line: COA.OTHER_INCOME, label_vi: 'Thu khác', driver: { type: 'fixed_schedule', monthly_vnd: 2_000_000 } },
          { line_id: 'oc', coa_line: COA.OTHER_COST, label_vi: 'Chi khác', driver: { type: 'fixed_schedule', monthly_vnd: 1_000_000 } },
        ],
      }),
    )
    const m = r.months[0]
    expect(m.ebitda).toBe(100_000_000)
    // 100 − 8 + 3 + 2 − 1 = 96tr
    expect(m.ebt).toBe(96_000_000)
  })

  it('7. thuế = 20% × lợi nhuận trước thuế (100tr → 20tr, còn lại 80tr)', () => {
    const r = runPlanEngine(basePlan())
    const m = r.months[0]
    expect(m.ebt).toBe(100_000_000)
    expect(m.tax).toBe(20_000_000)
    expect(m.net_income).toBe(80_000_000)
    expect(m.by_coa[COA.TAX]).toBe(20_000_000)
  })

  it('8. LỖ thì thuế = 0, KHÔNG âm (bẫy kinh điển của mô hình Excel)', () => {
    const r = runPlanEngine(
      basePlan({
        lines: [
          { line_id: 'rev', coa_line: COA.REV_GOODS, label_vi: 'DT', driver: { type: 'fixed_schedule', monthly_vnd: 10_000_000 } },
          { line_id: 'rent', coa_line: COA.OPEX_GA_RENT, label_vi: 'Thuê VP', driver: { type: 'fixed_schedule', monthly_vnd: 50_000_000 } },
        ],
      }),
    )
    const m = r.months[0]
    expect(m.ebt).toBe(-40_000_000)
    expect(m.tax).toBe(0) // không được âm — lỗ không tạo ra "lãi nhờ thuế"
    expect(m.net_income).toBe(-40_000_000)
  })

  it('9. thuế suất lấy theo tham số, KHÔNG cố định trong công thức', () => {
    const r10 = runPlanEngine(basePlan({ tax_rate_pct: 10 }))
    const r0 = runPlanEngine(basePlan({ tax_rate_pct: 0 }))
    expect(r10.months[0].tax).toBe(10_000_000)
    expect(r0.months[0].tax).toBe(0)
  })
})

describe('ZIPO-103 · vốn lưu động & dòng tiền', () => {
  it('10. phải thu = doanh thu × số ngày phải thu ÷ 30 (100tr, 30 ngày → 100tr)', () => {
    const r = runPlanEngine(basePlan({ working_capital: { dso_days: 30, dpo_days: 0, dio_days: 0 } }))
    expect(r.months[0].ar).toBe(100_000_000)
    expect(r.months[0].working_capital).toBe(100_000_000)
  })

  it('11. vốn lưu động tăng → tiền bị giam, dòng tiền tháng 1 thấp hơn lợi nhuận', () => {
    const noWc = runPlanEngine(basePlan())
    const withWc = runPlanEngine(basePlan({ working_capital: { dso_days: 30, dpo_days: 0, dio_days: 0 } }))
    expect(noWc.months[0].cf_operating).toBe(80_000_000) // = lợi nhuận sau thuế
    // bị giam 100tr phải thu → 80tr − 100tr = −20tr
    expect(withWc.months[0].cf_operating).toBe(-20_000_000)
    expect(withWc.months[0].cf_operating).toBeLessThan(noWc.months[0].cf_operating)
  })

  it('12. tiền liên tục: số dư cuối tháng này = đầu tháng sau, không đứt đoạn', () => {
    const r = runPlanEngine(basePlan({ opening_cash_vnd: 500_000_000 }))
    let cash = 500_000_000
    for (const m of r.months) {
      cash += m.cf_operating + m.equity_in - m.capex
      expect(m.cash).toBe(cash)
    }
    expect(r.summary.closing_cash).toBe(r.months[11].cash)
  })

  it('13. góp vốn và đầu tư tài sản vào đúng tháng được khai', () => {
    const r = runPlanEngine(
      basePlan({
        opening_cash_vnd: 0,
        equity_in: [{ month: 3, amount_vnd: 1_000_000_000 }],
        capex: [{ month: 5, amount_vnd: 200_000_000 }],
      }),
    )
    expect(r.months[2].equity_in).toBe(1_000_000_000)
    expect(r.months[1].equity_in).toBe(0)
    expect(r.months[4].capex).toBe(200_000_000)
  })
})

describe('ZIPO-103 · bất biến bắt buộc (vỡ là mô hình sai)', () => {
  it('14. tổng 12 tháng = tổng năm, không lệch một đồng', () => {
    const r = runPlanEngine(basePlan())
    const sumMonths = r.months.reduce((a, m) => a + m.revenue, 0)
    expect(r.yearly[0].revenue).toBe(sumMonths)
    expect(r.yearly[0].revenue).toBe(1_200_000_000)
  })

  it('15. mọi số tiền là SỐ NGUYÊN đồng (cấm số thực — ràng buộc #4)', () => {
    const r = runPlanEngine(
      basePlan({
        lines: [
          { line_id: 'rev', coa_line: COA.REV_GOODS, label_vi: 'DT', driver: { type: 'fixed_schedule', monthly_vnd: 33_333_333 } },
          { line_id: 'cogs', coa_line: COA.COGS, label_vi: 'Giá vốn', driver: { type: 'pct_of_revenue', pct: 33.33 } },
        ],
        working_capital: { dso_days: 17, dpo_days: 11, dio_days: 7 },
      }),
    )
    for (const m of r.months) {
      for (const v of [m.revenue, m.cogs, m.ebitda, m.tax, m.net_income, m.ar, m.ap, m.inventory, m.cash]) {
        expect(Number.isInteger(v)).toBe(true)
      }
    }
  })

  it('16. fail-closed: giả định vô lý thì BÁO LỖI, không tự đoán (ràng buộc #7)', () => {
    expect(() => runPlanEngine(basePlan({ tax_rate_pct: -5 }))).toThrow()
    expect(() => runPlanEngine(basePlan({ tax_rate_pct: 150 }))).toThrow()
    expect(() =>
      runPlanEngine(basePlan({ working_capital: { dso_days: -10, dpo_days: 0, dio_days: 0 } })),
    ).toThrow()
  })
})

describe('ZIPO-103 · kịch bản, độ nhạy, chỉ tiêu', () => {
  it('17. ba kịch bản dùng CHUNG một bộ giả định: lạc quan ≥ cơ sở ≥ thận trọng', () => {
    const input = basePlan({
      lines: [
        {
          line_id: 'rev',
          coa_line: COA.REV_GOODS,
          label_vi: 'DT',
          driver: { type: 'price_volume', price_vnd: 50_000, volume_month1: 200, growth_pct_m: 10 },
        },
      ],
      scenario_multipliers: { bull: 1.2, bear: 0.8 },
    })
    const all = runAllScenarios(input)
    expect(all.bull.summary.total_revenue).toBeGreaterThanOrEqual(all.base.summary.total_revenue)
    expect(all.base.summary.total_revenue).toBeGreaterThanOrEqual(all.bear.summary.total_revenue)
  })

  it('18. phân tích độ nhạy trả về danh sách có xếp hạng ảnh hưởng', () => {
    const rows = runSensitivity(
      basePlan({
        horizon_months: 36,
        lines: [
          {
            line_id: 'rev',
            coa_line: COA.REV_GOODS,
            label_vi: 'DT',
            driver: { type: 'price_volume', price_vnd: 50_000, volume_month1: 200, growth_pct_m: 5 },
          },
          { line_id: 'cogs', coa_line: COA.COGS, label_vi: 'Giá vốn', driver: { type: 'pct_of_revenue', pct: 40 } },
        ],
      }),
      3,
    )
    expect(Array.isArray(rows)).toBe(true)
    expect(rows.length).toBeGreaterThan(0)
  })

  it('19. chỉ tiêu xuất ra mang mã COA + số nguyên VND (hợp đồng gửi ZeniOS)', () => {
    const input = basePlan()
    const targets = toPlanTargets(input, runPlanEngine(input))
    expect(targets.length).toBeGreaterThan(0)
    for (const t of targets) {
      expect(Number.isInteger(t.amount)).toBe(true)
      expect(typeof t.coa_line).toBe('string')
      expect(t.coa_line.length).toBeGreaterThan(0)
      expect(t.period).toMatch(/^\d{4}-\d{2}-01$/) // kỳ luôn là ngày đầu tháng
    }
    const rev = targets.filter((t) => t.coa_line === COA.REV_GOODS).reduce((a, t) => a + t.amount, 0)
    expect(rev).toBe(1_200_000_000)
    // thuế phải được engine tự gắn vào chỉ tiêu, không phải dòng người dùng nhập
    const tax = targets.filter((t) => t.coa_line === COA.TAX).reduce((a, t) => a + t.amount, 0)
    expect(tax).toBe(240_000_000) // 20tr/tháng × 12
  })

  it('20. cùng đầu vào luôn cho cùng kết quả (tất định — nhà đầu tư tái lập được)', () => {
    const a = runPlanEngine(basePlan())
    const b = runPlanEngine(basePlan())
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})
