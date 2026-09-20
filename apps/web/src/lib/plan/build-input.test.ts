import { describe, expect, it } from 'vitest'
import { buildPlanInput } from './build-input'
import type { ZeniClient } from '@/lib/zeni/compat'

/**
 * TÁCH MUA TÀI SẢN RA KHỎI CHI PHÍ — chỗ sai thì cả ba báo cáo cùng sai.
 *
 * Mua một cái máy 240tr không phải chi phí tháng đó: nó lên bảng cân đối rồi
 * chảy dần vào lãi lỗ qua khấu hao. Nhét nhầm vào `lines` thì lợi nhuận tháng
 * đó thủng 240tr, thuế tính sai, tài sản cố định không bao giờ xuất hiện —
 * mà vẫn "cân" nên bất biến không bắt được. Chỉ test mới bắt được.
 */

/** Client giả: trả đúng bảng nào hỏi, đủ chuỗi gọi mà build-input dùng. */
function clientGia(bang: Record<string, unknown[]>): ZeniClient {
  const taoTruyVan = (ten: string) => {
    const api: Record<string, unknown> = {}
    const tra = { data: bang[ten] ?? [], error: null }
    for (const m of ['select', 'eq', 'lte', 'order', 'limit']) api[m] = () => api
    api.maybeSingle = () => Promise.resolve({ data: (bang[ten] ?? [])[0] ?? null, error: null })
    api.then = (res: (v: unknown) => unknown) => Promise.resolve(tra).then(res)
    return api
  }
  return { from: (ten: string) => taoTruyVan(ten) } as unknown as ZeniClient
}

const banKeHoach = {
  id: 'v1',
  horizon_months: 12,
  start_period: '2026-01-01',
  status: 'draft',
}

describe('Dựng đầu vào kế hoạch từ CSDL', () => {
  it('1. dòng mã 211 thành CAPEX, không nằm trong chi phí lãi lỗ', async () => {
    const r = await buildPlanInput(
      clientGia({
        plan_versions: [banKeHoach],
        plan_lines: [
          { id: 'l1', coa_line: '5111', label_vi: 'Doanh thu', company_id: null,
            driver_type: 'fixed_schedule', driver_config: { monthly_vnd: 100_000_000 } },
          { id: 'l2', coa_line: '211', label_vi: 'Mua máy', company_id: null,
            driver_type: 'manual', driver_config: { amounts_vnd: [240_000_000, 0, 60_000_000] } },
        ],
        plan_assumptions: [],
        tax_rates: [{ rate_pct: 20, effective_from: '2020-01-01' }],
      }),
      'v1',
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    // Chỉ còn dòng doanh thu ở lines — dòng tài sản đã tách ra.
    expect(r.input.lines).toHaveLength(1)
    expect(r.input.lines[0].coa_line).toBe('5111')
    // Số 0 ở tháng 2 KHÔNG được sinh ra một lần mua bằng 0.
    expect(r.input.capex).toEqual([
      { month: 1, amount_vnd: 240_000_000 },
      { month: 3, amount_vnd: 60_000_000 },
    ])
  })

  it('2. CHỈ có dòng mua tài sản ⇒ từ chối, không dựng kế hoạch rỗng doanh thu', async () => {
    const r = await buildPlanInput(
      clientGia({
        plan_versions: [banKeHoach],
        plan_lines: [
          { id: 'l1', coa_line: '211', label_vi: 'Mua máy', company_id: null,
            driver_type: 'manual', driver_config: { amounts_vnd: [240_000_000] } },
        ],
        plan_assumptions: [],
        tax_rates: [],
      }),
      'v1',
    )
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('doanh thu')
  })

  it('3. mã 211 với động lực lạ thì BỎ QUA, không đoán bừa cách quy đổi', async () => {
    const r = await buildPlanInput(
      clientGia({
        plan_versions: [banKeHoach],
        plan_lines: [
          { id: 'l1', coa_line: '5111', label_vi: 'Doanh thu', company_id: null,
            driver_type: 'fixed_schedule', driver_config: { monthly_vnd: 100_000_000 } },
          { id: 'l2', coa_line: '211', label_vi: 'Mua máy kiểu lạ', company_id: null,
            driver_type: 'pct_of_revenue', driver_config: { pct: 10 } },
        ],
        plan_assumptions: [],
        tax_rates: [],
      }),
      'v1',
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.input.capex).toBeUndefined()
    // Và nó cũng KHÔNG lọt xuống lines — nhầm sang chi phí là sai nặng hơn.
    expect(r.input.lines.map((l) => l.coa_line)).toEqual(['5111'])
  })

  it('4. giả định mới (khấu hao, vốn chủ đầu kỳ) đi tới engine', async () => {
    const r = await buildPlanInput(
      clientGia({
        plan_versions: [banKeHoach],
        plan_lines: [
          { id: 'l1', coa_line: '5111', label_vi: 'Doanh thu', company_id: null,
            driver_type: 'fixed_schedule', driver_config: { monthly_vnd: 100_000_000 } },
        ],
        plan_assumptions: [
          { key: 'opening_cash_vnd', value_base: 500_000_000 },
          { key: 'opening_equity_vnd', value_base: 800_000_000 },
          { key: 'depreciation_years', value_base: 3 },
          { key: 'dso_days', value_base: 30 },
        ],
        tax_rates: [],
      }),
      'v1',
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.input.opening_cash_vnd).toBe(500_000_000)
    expect(r.input.opening_equity_vnd).toBe(800_000_000)
    expect(r.input.depreciation_years).toBe(3)
    expect(r.input.working_capital.dso_days).toBe(30)
  })

  it('5. không khai giả định thì để TRỐNG, không bịa mặc định kinh doanh', async () => {
    const r = await buildPlanInput(
      clientGia({
        plan_versions: [banKeHoach],
        plan_lines: [
          { id: 'l1', coa_line: '5111', label_vi: 'Doanh thu', company_id: null,
            driver_type: 'fixed_schedule', driver_config: { monthly_vnd: 100_000_000 } },
        ],
        plan_assumptions: [],
        tax_rates: [],
      }),
      'v1',
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    // undefined ⇒ engine dùng mặc định CỦA NÓ và ghi rõ trong tài liệu, chứ
    // build-input không tự nghĩ ra một con số kinh doanh.
    expect(r.input.opening_equity_vnd).toBeUndefined()
    expect(r.input.depreciation_years).toBeUndefined()
    expect(r.input.capex).toBeUndefined()
  })
})
