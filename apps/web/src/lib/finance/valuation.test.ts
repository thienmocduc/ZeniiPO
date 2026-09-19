/**
 * TEST SỐ CỨNG — 3 PHƯƠNG PHÁP ĐỊNH GIÁ
 *
 * Định giá là con số đem đi đàm phán vốn. Sai một hệ số là sai hàng tỷ, nên
 * mọi kỳ vọng dưới đây tính tay từ công thức, không so lại kết quả của chính hàm.
 */
import { describe, expect, it } from 'vitest'
import { median, valuateComparables, valuateDcf, valuateVcMethod } from './valuation'

describe('Định giá · tiện ích', () => {
  it('1. trung vị lẻ phần tử = phần tử giữa', () => {
    expect(median([3, 1, 2])).toBe(2)
  })

  it('2. trung vị chẵn phần tử = trung bình 2 giá trị giữa', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5)
  })

  it('3. danh sách rỗng trả null, không trả 0 (0 là con số có nghĩa, null mới là "không có")', () => {
    expect(median([])).toBeNull()
  })
})

describe('Định giá · so sánh thị trường', () => {
  it('4. dùng TRUNG VỊ bội số, không dùng trung bình (một công ty ngoại lai không được bóp méo)', () => {
    const r = valuateComparables({
      revenue: 1_000_000,
      comparables: [
        { company_name: 'A', ev_revenue_multiple: 2 },
        { company_name: 'B', ev_revenue_multiple: 4 },
        { company_name: 'C', ev_revenue_multiple: 100 }, // ngoại lai
      ],
      illiquidity_discount_pct: 0,
    })
    // trung vị = 4 (không phải trung bình 35,33)
    expect(r.multiples_used.ev_revenue).toBe(4)
    expect(r.enterprise_value).toBe(4_000_000)
  })

  it('5. chiết khấu thanh khoản mặc định 25% cho công ty chưa niêm yết', () => {
    const r = valuateComparables({
      revenue: 1_000_000,
      comparables: [{ company_name: 'A', ev_revenue_multiple: 4 }],
    })
    expect(r.illiquidity_discount_pct).toBe(25)
    expect(r.enterprise_value).toBe(3_000_000) // 4tr × (1 − 0,25)
  })

  it('6. giá trị vốn chủ sở hữu = giá trị doanh nghiệp − nợ ròng', () => {
    const r = valuateComparables({
      revenue: 1_000_000,
      net_debt: 500_000,
      comparables: [{ company_name: 'A', ev_revenue_multiple: 4 }],
      illiquidity_discount_pct: 0,
    })
    expect(r.equity_value).toBe(3_500_000)
  })

  it('7. EBITDA âm thì KHÔNG dùng bội số EBITDA (vô nghĩa về tài chính)', () => {
    const r = valuateComparables({
      revenue: 1_000_000,
      ebitda: -200_000,
      comparables: [{ company_name: 'A', ev_revenue_multiple: 4, ev_ebitda_multiple: 10 }],
      illiquidity_discount_pct: 0,
    })
    expect(r.ev_by_ebitda).toBeNull()
    expect(r.enterprise_value).toBe(4_000_000) // chỉ theo doanh thu
  })
})

describe('Định giá · chiết khấu dòng tiền', () => {
  it('8. CHẶN khi chi phí vốn ≤ tăng trưởng vĩnh viễn (mô hình vô nghĩa về toán học)', () => {
    const r = valuateDcf({
      fcf_year1: 1_000_000,
      growth_rate_pct: 10,
      years: 5,
      wacc_pct: 3,
      terminal_growth_pct: 3,
    })
    expect(r.enterprise_value).toBeNull()
    expect(r.error).toBeTruthy()
  })

  it('9. giá trị hiện tại 1 năm = dòng tiền ÷ (1 + chi phí vốn)', () => {
    const r = valuateDcf({
      fcf_year1: 1_100_000,
      growth_rate_pct: 0,
      years: 1,
      wacc_pct: 10,
      terminal_growth_pct: 0,
    })
    // giá trị hiện tại của năm 1 = 1.100.000 / 1,1 = 1.000.000
    expect(r.pv_explicit).toBe(1_000_000)
    // giá trị cuối kỳ = 1.100.000 / 0,1 = 11.000.000 → hiện tại = 10.000.000
    expect(r.terminal_value).toBe(11_000_000)
    expect(r.pv_terminal).toBe(10_000_000)
    expect(r.enterprise_value).toBe(11_000_000)
  })

  it('10. cảnh báo được khi giá trị cuối kỳ chiếm phần quá lớn (đặt cược vào tương lai xa)', () => {
    const r = valuateDcf({
      fcf_year1: 1_000_000,
      growth_rate_pct: 0,
      years: 3,
      wacc_pct: 12,
      terminal_growth_pct: 3,
    })
    expect(r.terminal_pct_of_ev).toBeGreaterThan(70)
    expect(r.terminal_pct_of_ev).toBeLessThanOrEqual(100)
  })
})

describe('Định giá · phương pháp quỹ mạo hiểm', () => {
  it('11. định giá sau đầu tư = giá trị thoái vốn ÷ (1 + tỷ suất)^số năm', () => {
    const r = valuateVcMethod({
      exit_revenue: 10_000_000,
      exit_multiple: 10,
      years_to_exit: 2,
      target_irr_pct: 100,
      investment_usd: 10_000_000,
    })
    // thoái vốn = 100tr; (1+1)^2 = 4 → sau đầu tư = 25tr; trước đầu tư = 15tr
    expect(r.exit_value).toBe(100_000_000)
    expect(r.post_money).toBe(25_000_000)
    expect(r.pre_money).toBe(15_000_000)
    expect(r.ownership_required_pct).toBe(40) // 10tr / 25tr
  })

  it('12. tỷ lệ sở hữu điều chỉnh theo pha loãng các vòng sau (mặc định 25%)', () => {
    const r = valuateVcMethod({
      exit_revenue: 10_000_000,
      exit_multiple: 10,
      years_to_exit: 2,
      target_irr_pct: 100,
      investment_usd: 10_000_000,
    })
    expect(r.assumptions.future_dilution_pct).toBe(25)
    // 40% / (1 − 0,25) = 53,3%
    expect(r.ownership_adjusted_for_dilution_pct).toBeCloseTo(53.3, 1)
  })
})
