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
import fs from 'node:fs'
import path from 'node:path'
import {
  COA,
  runPlanEngine,
  runAllScenarios,
  runSensitivity,
  toPlanTargets,
  COA_CAN_DOI,
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
    // ⚠ PHẢI LÀ LỚN HƠN HẲN, không phải ">=". Bản trước dùng `>=` nên test
    // vẫn xanh kể cả khi ba kịch bản ra số GIỐNG HỆT NHAU — tức là nó không
    // canh được đúng thứ nó định canh.
    expect(all.bull.summary.total_revenue).toBeGreaterThan(all.base.summary.total_revenue)
    expect(all.base.summary.total_revenue).toBeGreaterThan(all.bear.summary.total_revenue)
  })

  it('17b. fixed_schedule — kiểu mặc định — CŨNG phải đổi theo kịch bản', () => {
    // Lỗi thật: `fixed_schedule` không nhân hệ số kịch bản vào tốc độ tăng,
    // trong khi ba kiểu động lực khác đều nhân. Một kế hoạch chỉ gồm dòng
    // fixed_schedule cho ra ba kịch bản y hệt nhau — phát hiện khi chạy thật
    // trên production.
    const input = basePlan({
      lines: [
        {
          line_id: 'rev',
          coa_line: COA.REV_GOODS,
          label_vi: 'Doanh thu dịch vụ',
          driver: { type: 'fixed_schedule', monthly_vnd: 800_000_000, growth_pct_m: 4 },
        },
      ],
      scenario_multipliers: { bull: 1.2, bear: 0.8 },
    })
    const all = runAllScenarios(input)
    expect(all.bull.summary.total_revenue).toBeGreaterThan(all.base.summary.total_revenue)
    expect(all.base.summary.total_revenue).toBeGreaterThan(all.bear.summary.total_revenue)
  })

  it('17c. fixed_schedule KHÔNG có tăng trưởng thì ba kịch bản bằng nhau — đúng vậy', () => {
    // Không tăng trưởng thì không có gì để nhân hệ số. Chốt lại để lần sau
    // không ai "sửa" thành nhân vào số gốc: hệ số kịch bản áp lên GIẢ ĐỊNH
    // TĂNG TRƯỞNG, không áp lên số tiền đã cam kết.
    const input = basePlan({
      lines: [
        {
          line_id: 'thue',
          coa_line: COA.OPEX_GA_RENT,
          label_vi: 'Thuê văn phòng',
          driver: { type: 'fixed_schedule', monthly_vnd: 30_000_000 },
        },
        {
          line_id: 'rev',
          coa_line: COA.REV_GOODS,
          label_vi: 'Doanh thu',
          driver: { type: 'fixed_schedule', monthly_vnd: 100_000_000 },
        },
      ],
      scenario_multipliers: { bull: 1.2, bear: 0.8 },
    })
    const all = runAllScenarios(input)
    expect(all.bull.summary.total_revenue).toBe(all.base.summary.total_revenue)
    expect(all.bear.summary.total_revenue).toBe(all.base.summary.total_revenue)
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

// ════════════════════════════════════════════════════════════════════════
// BẢNG CÂN ĐỐI KẾ TOÁN + KHẤU HAO
//
// Bản engine trước KHÔNG có bảng cân đối và KHÔNG có khấu hao: chi capex nhưng
// tài sản cố định không bao giờ giảm, và thuế bị tính THỪA vì thiếu lá chắn
// khấu hao. Một mô hình không cân được thì không phải mô hình tài chính — nó là
// bản chiếu doanh thu.
//
// Mọi con số dưới đây tính TAY từ giả định, không lấy lại kết quả của engine.
// ════════════════════════════════════════════════════════════════════════
describe('Bảng cân đối kế toán', () => {
  /** Kế hoạch có mua tài sản để khấu hao thật sự phát sinh. */
  const coTaiSan = () =>
    basePlan({
      horizon_months: 12,
      opening_cash_vnd: 500_000_000,
      capex: [{ month: 1, amount_vnd: 240_000_000 }],
      depreciation_years: 5, // 60 tháng → 4tr/tháng
      tax_rate_pct: 20,
    })

  it('21. TÀI SẢN = NỢ PHẢI TRẢ + VỐN CHỦ SỞ HỮU, ở MỌI tháng, lệch 0 đồng', () => {
    const r = runPlanEngine(coTaiSan())
    for (const m of r.months) {
      expect(
        m.total_assets - (m.total_liabilities + m.total_equity),
        `tháng ${m.month} lệch`,
      ).toBe(0)
    }
  })

  it('22. khấu hao đường thẳng: 240tr / 60 tháng = 4tr/tháng, bắt đầu từ THÁNG 2', () => {
    const r = runPlanEngine(coTaiSan())
    // Tháng 1 mua tài sản — chưa khấu hao.
    expect(r.months[0].depreciation).toBe(0)
    expect(r.months[1].depreciation).toBe(4_000_000)
    expect(r.months[11].depreciation).toBe(4_000_000)
    // 11 tháng có khấu hao (tháng 2→12) × 4tr = 44tr
    expect(r.months[11].acc_depreciation).toBe(44_000_000)
  })

  it('23. giá trị còn lại của TSCĐ = nguyên giá − hao mòn luỹ kế', () => {
    const r = runPlanEngine(coTaiSan())
    const cuoi = r.months[11]
    expect(cuoi.fixed_assets_gross).toBe(240_000_000)
    expect(cuoi.fixed_assets_net).toBe(240_000_000 - 44_000_000)
  })

  it('24. hao mòn luỹ kế KHÔNG BAO GIỜ vượt nguyên giá, kể cả khi chia KHÔNG HẾT', () => {
    // Engine giới hạn tầm nhìn 60 tháng. Chọn kỳ khấu hao 3 năm (36 tháng) để
    // chạy QUÁ thời gian khấu hao trong giới hạn đó.
    //
    // Và chọn 240tr/36 tháng = 6.666.666,67 đ — CỐ Ý chia không hết. Làm tròn
    // từng tháng rồi cộng 36 tháng sẽ vượt nguyên giá vài đồng nếu không chặn.
    // Tài sản có giá trị còn lại ÂM là vô nghĩa, dù chỉ âm 12 đồng.
    const r = runPlanEngine(basePlan({
      horizon_months: 60,
      opening_cash_vnd: 1_000_000_000,
      capex: [{ month: 1, amount_vnd: 240_000_000 }],
      depreciation_years: 3,
    }))
    for (const m of r.months) {
      expect(m.acc_depreciation, `tháng ${m.month}`).toBeLessThanOrEqual(m.fixed_assets_gross)
      expect(m.fixed_assets_net, `tháng ${m.month}`).toBeGreaterThanOrEqual(0)
    }
    // Khấu hao hết thì giá trị còn lại phải bằng ĐÚNG 0, không phải "gần 0".
    expect(r.months[59].fixed_assets_net).toBe(0)
    expect(r.months[59].acc_depreciation).toBe(240_000_000)
  })

  it('25. KHẤU HAO LÀ LÁ CHẮN THUẾ — có khấu hao thì thuế phải THẤP HƠN', () => {
    const khong = runPlanEngine(basePlan({ horizon_months: 12, opening_cash_vnd: 500_000_000 }))
    const co = runPlanEngine(coTaiSan())
    const thueKhong = khong.months.reduce((s, m) => s + m.tax, 0)
    const thueCo = co.months.reduce((s, m) => s + m.tax, 0)
    // 44tr khấu hao × 20% thuế = 8,8tr tiền thuế tiết kiệm được
    expect(thueKhong - thueCo).toBe(44_000_000 * 0.2)
  })

  it('26. EBIT = EBITDA − khấu hao (trước đây thiếu, EBITDA bị dùng thay EBIT)', () => {
    const r = runPlanEngine(coTaiSan())
    for (const m of r.months) {
      expect(m.ebit).toBe(m.ebitda - m.depreciation)
    }
    expect(r.months[1].ebitda).toBe(100_000_000)
    expect(r.months[1].ebit).toBe(96_000_000)
  })

  it('27. LƯU CHUYỂN TIỀN GIÁN TIẾP cộng lại khấu hao (chi phí không bằng tiền)', () => {
    const r = runPlanEngine(coTaiSan())
    for (const m of r.months) {
      expect(m.cf_operating).toBe(m.net_income + m.depreciation - m.delta_wc)
    }
  })

  it('28. tiền cuối kỳ khớp bảng cân đối: tiền = tổng tài sản − phải thu − tồn kho − TSCĐ còn lại', () => {
    const r = runPlanEngine(basePlan({
      horizon_months: 6,
      opening_cash_vnd: 200_000_000,
      capex: [{ month: 2, amount_vnd: 60_000_000 }],
      equity_in: [{ month: 3, amount_vnd: 500_000_000 }],
      working_capital: { dso_days: 30, dpo_days: 15, dio_days: 20 },
    }))
    for (const m of r.months) {
      expect(m.cash).toBe(m.total_assets - m.ar - m.inventory - m.fixed_assets_net)
    }
  })

  it('29. vốn góp luỹ kế = vốn đầu kỳ + mọi lần góp thêm', () => {
    const r = runPlanEngine(basePlan({
      horizon_months: 6,
      opening_cash_vnd: 100_000_000,
      equity_in: [
        { month: 2, amount_vnd: 300_000_000 },
        { month: 5, amount_vnd: 700_000_000 },
      ],
    }))
    expect(r.months[0].paid_in_capital).toBe(100_000_000)
    expect(r.months[1].paid_in_capital).toBe(400_000_000)
    expect(r.months[5].paid_in_capital).toBe(1_100_000_000)
  })

  it('30. lợi nhuận giữ lại = cộng dồn lợi nhuận sau thuế', () => {
    const r = runPlanEngine(basePlan({ horizon_months: 6, opening_cash_vnd: 0 }))
    let cong = 0
    for (const m of r.months) {
      cong += m.net_income
      expect(m.retained_earnings, `tháng ${m.month}`).toBe(cong)
    }
  })

  it('31. lỗ thì vốn chủ sở hữu GIẢM — không được giữ nguyên', () => {
    const r = runPlanEngine(basePlan({
      horizon_months: 3,
      opening_cash_vnd: 1_000_000_000,
      lines: [
        {
          line_id: 'rev',
          coa_line: COA.REV_GOODS,
          label_vi: 'Doanh thu',
          driver: { type: 'fixed_schedule', monthly_vnd: 10_000_000 },
        },
        {
          line_id: 'opex',
          coa_line: COA.OPEX_GA_RENT,
          label_vi: 'Thuê văn phòng',
          driver: { type: 'fixed_schedule', monthly_vnd: 50_000_000 },
        },
      ],
    }))
    // Lỗ 40tr/tháng, thuế = 0 khi lỗ
    expect(r.months[0].net_income).toBe(-40_000_000)
    expect(r.months[0].tax).toBe(0)
    expect(r.months[2].total_equity).toBeLessThan(r.months[0].total_equity)
    expect(r.months[2].retained_earnings).toBe(-120_000_000)
  })
})

describe('Hợp đồng ba tầng: chỉ tiêu đẩy sang ZeniOS/ZeniERP', () => {
  const keHoach = () =>
    basePlan({
      horizon_months: 12,
      opening_cash_vnd: 500_000_000,
      capex: [{ month: 1, amount_vnd: 120_000_000 }],
      depreciation_years: 5,
      working_capital: { dso_days: 30, dpo_days: 15, dio_days: 0 },
    })

  it('32. khấu hao PHẢI có chỉ tiêu — nếu không, mọi đồng ERP báo về đều hiện "vượt dự toán"', () => {
    const input = keHoach()
    const targets = toPlanTargets(input, runPlanEngine(input))
    const khauHao = targets.filter((t) => t.coa_line === COA.DEPRECIATION)
    // Mua tháng 1, khấu hao từ tháng 2 ⇒ 11 tháng có số trong tầm nhìn 12 tháng.
    expect(khauHao).toHaveLength(11)
    expect(khauHao.every((t) => t.amount === 2_000_000)).toBe(true) // 120tr/60 tháng
  })

  it('33. số dư bảng cân đối được đẩy sang, gắn cấp tập đoàn', () => {
    const input = keHoach()
    const targets = toPlanTargets(input, runPlanEngine(input))
    const maCanDoi = new Set<string>(COA_CAN_DOI)
    const canDoi = targets.filter((t) => maCanDoi.has(t.coa_line))
    expect(canDoi.length).toBeGreaterThan(0)
    // Số dư sinh từ mô hình hợp nhất, không quy được về một công ty con.
    expect(canDoi.every((t) => t.company_id === null)).toBe(true)
  })

  it('34. số dư TIỀN trong chỉ tiêu khớp ĐÚNG số dư engine từng tháng', () => {
    const input = keHoach()
    const r = runPlanEngine(input)
    const targets = toPlanTargets(input, r)
    for (const thang of r.months) {
      if (thang.cash === 0) continue
      const t = targets.find((x) => x.period === thang.period && x.coa_line === COA.CASH)
      expect(t, `thiếu số dư tiền tháng ${thang.month}`).toBeDefined()
      expect(t!.amount).toBe(thang.cash)
    }
  })

  it('35. số dư KHÔNG được cộng dồn: tổng 12 tháng KHÁC số dư cuối kỳ', () => {
    // Đây chính là cái bẫy mà cột `statement` sinh ra để chặn. Test này khoá
    // lại sự thật đó để không ai "tối ưu" bằng cách cộng dồn dòng 'bs'.
    const input = keHoach()
    const r = runPlanEngine(input)
    const targets = toPlanTargets(input, r)
    const tongDon = targets
      .filter((t) => t.coa_line === COA.CASH)
      .reduce((a, t) => a + t.amount, 0)
    const duCuoiKy = r.months[r.months.length - 1].cash
    expect(tongDon).not.toBe(duCuoiKy)
    expect(duCuoiKy).toBeGreaterThan(0)
  })

  it('36. MỌI mã đẩy đi đều phải có trong danh mục COA của CSDL (khoá ngoại)', () => {
    // plan_targets.coa_line có KHOÁ NGOẠI trỏ plan_coa_lines(code). Đẩy một mã
    // chưa nạp thì publish đổ ở CSDL chứ không đổ ở đây — muộn và khó truy.
    //
    // Danh sách mã ĐỌC THẲNG TỪ FILE MIGRATION, không chép tay. Chép tay thì
    // test vẫn xanh sau khi ai đó sửa migration, tức là canh một danh sách
    // không còn tồn tại.
    const thuMucMigration = path.resolve(process.cwd(), '../../packages/database/zenicloud')
    const daNapTrongCsdl = new Set<string>()
    for (const f of fs.readdirSync(thuMucMigration).filter((x) => x.endsWith('.sql'))) {
      const noiDung = fs.readFileSync(path.join(thuMucMigration, f), 'utf8')
      // Bắt các dòng INSERT ... INTO plan_coa_lines rồi lấy mã ở đầu mỗi bộ giá trị.
      for (const khoi of noiDung.split(/INSERT\s+INTO\s+plan_coa_lines/i).slice(1)) {
        const denHetCauLenh = khoi.split(/;\s/)[0]
        for (const m of denHetCauLenh.matchAll(/\(\s*'([0-9]{3,4})'\s*,/g)) daNapTrongCsdl.add(m[1])
      }
    }
    // Chốt lại: nếu regex trên hỏng thì tập rỗng và test sẽ xanh sai.
    expect(daNapTrongCsdl.size).toBeGreaterThanOrEqual(23)

    const input = basePlan({
      horizon_months: 12,
      opening_cash_vnd: 500_000_000,
      capex: [{ month: 1, amount_vnd: 120_000_000 }],
      working_capital: { dso_days: 30, dpo_days: 15, dio_days: 20 },
      lines: [
        { line_id: 'rev', coa_line: COA.REV_GOODS, label_vi: 'Doanh thu', driver: { type: 'fixed_schedule', monthly_vnd: 200_000_000 } },
        { line_id: 'cogs', coa_line: COA.COGS, label_vi: 'Giá vốn', driver: { type: 'pct_of_revenue', pct: 40 } },
      ],
    })
    const targets = toPlanTargets(input, runPlanEngine(input))
    const thieu = [...new Set(targets.map((t) => t.coa_line))].filter((m) => !daNapTrongCsdl.has(m))
    expect(thieu, `mã engine đẩy đi nhưng CHƯA nạp vào plan_coa_lines: ${thieu.join(', ')}`).toEqual([])
  })
})
