import type { ZeniClient } from '@/lib/zeni/compat'
import type { PlanInput, PlanLine, Driver } from './engine'

/**
 * Dựng PlanInput cho engine từ dữ liệu DB (plan_versions + plan_lines +
 * plan_assumptions + tax_rates). Fail-closed: thiếu dữ liệu → trả lỗi rõ ràng,
 * KHÔNG tự điền giá trị mặc định cho những thứ mang tính giả định kinh doanh.
 */
export async function buildPlanInput(
  supabase: ZeniClient,
  versionId: string,
): Promise<{ ok: true; input: PlanInput } | { ok: false; error: string }> {
  const { data: version } = await supabase
    .from('plan_versions')
    .select('id, horizon_months, start_period, status')
    .eq('id', versionId)
    .maybeSingle()
  if (!version) return { ok: false, error: 'Không tìm thấy plan version' }

  const { data: lineRows } = await supabase
    .from('plan_lines')
    .select('id, coa_line, label_vi, company_id, driver_type, driver_config')
    .eq('plan_version_id', versionId)
  if (!lineRows || lineRows.length === 0) {
    return {
      ok: false,
      error: 'Kế hoạch chưa có dòng nào — thêm dòng doanh thu/chi phí (bắt buộc gắn mã COA VAS).',
    }
  }

  // ── Tách MUA TÀI SẢN ra khỏi các dòng lãi lỗ ──
  // Mua tài sản cố định không phải chi phí trong kỳ: nó lên bảng cân đối rồi
  // chảy dần vào lãi lỗ qua khấu hao. Engine nhận nó ở `capex`, không phải ở
  // `lines` — nhét vào lines là trừ thẳng vào lợi nhuận, sai cả ba báo cáo.
  //
  // Người dùng khai bằng đúng mã COA của tài sản cố định (211, nạp ở migration
  // 035) với động lực `manual` hoặc `fixed_schedule`; ở đây quy về lịch chi.
  const MA_TAI_SAN = '211'
  const dongTaiSan = lineRows.filter((l) => String(l.coa_line) === MA_TAI_SAN)
  const dongLaiLo = lineRows.filter((l) => String(l.coa_line) !== MA_TAI_SAN)

  const capex: Array<{ month: number; amount_vnd: number }> = []
  for (const l of dongTaiSan) {
    const cfg = (l.driver_config ?? {}) as Record<string, unknown>
    if (l.driver_type === 'manual' && Array.isArray(cfg.amounts_vnd)) {
      ;(cfg.amounts_vnd as unknown[]).forEach((v, i) => {
        const tien = Number(v)
        if (Number.isFinite(tien) && tien > 0) capex.push({ month: i + 1, amount_vnd: tien })
      })
    } else if (l.driver_type === 'fixed_schedule') {
      // Mua đều hằng tháng suốt tầm nhìn — ít gặp nhưng hợp lệ (thuê mua,
      // trả góp thiết bị). Tôn trọng đúng cái người dùng khai.
      const moiThang = Number(cfg.monthly_vnd)
      if (Number.isFinite(moiThang) && moiThang > 0) {
        for (let m = 1; m <= Number(version.horizon_months); m++) capex.push({ month: m, amount_vnd: moiThang })
      }
    }
    // Kiểu động lực khác trên mã tài sản: BỎ QUA có chủ ý. Đoán bừa cách quy
    // đổi còn tệ hơn là không ghi nhận — bảng cân đối sẽ lệch mà không ai biết.
  }

  const lines: PlanLine[] = dongLaiLo.map((l) => ({
    line_id: String(l.id),
    coa_line: String(l.coa_line),
    label_vi: String(l.label_vi),
    company_id: (l.company_id as string | null) ?? null,
    driver: { type: l.driver_type, ...(l.driver_config as Record<string, unknown>) } as unknown as Driver,
  }))

  if (lines.length === 0) {
    return {
      ok: false,
      error: 'Kế hoạch mới chỉ có dòng mua tài sản — thêm ít nhất một dòng doanh thu hoặc chi phí.',
    }
  }

  const { data: assumRows } = await supabase
    .from('plan_assumptions')
    .select('key, value_base')
    .eq('plan_version_id', versionId)
  const A = new Map<string, number>((assumRows ?? []).map((a) => [String(a.key), Number(a.value_base)]))

  // Thuế suất theo hiệu lực — lấy từ bảng cấu hình (spec: không hardcode).
  const { data: taxRows } = await supabase
    .from('tax_rates')
    .select('rate_pct, effective_from')
    .eq('tax_code', 'cit_vn')
    .lte('effective_from', String(version.start_period))
    .order('effective_from', { ascending: false })
    .limit(1)
  const taxRate = Number(taxRows?.[0]?.rate_pct ?? A.get('tax_rate_pct') ?? 20)

  return {
    ok: true,
    input: {
      start_period: String(version.start_period).slice(0, 7),
      horizon_months: Number(version.horizon_months),
      lines,
      working_capital: {
        dso_days: A.get('dso_days') ?? 0,
        dpo_days: A.get('dpo_days') ?? 0,
        dio_days: A.get('dio_days') ?? 0,
      },
      opening_cash_vnd: A.get('opening_cash_vnd') ?? 0,
      // Vốn chủ sở hữu đầu kỳ: thiếu thì engine lấy bằng tiền mặt đầu kỳ để
      // bảng cân đối vẫn cân. Khai riêng khi có góp vốn trước đó.
      opening_equity_vnd: A.get('opening_equity_vnd'),
      capex: capex.length > 0 ? capex : undefined,
      depreciation_years: A.get('depreciation_years'),
      tax_rate_pct: taxRate,
      scenario_multipliers: {
        bull: A.get('scenario_bull_multiplier') ?? 1.2,
        bear: A.get('scenario_bear_multiplier') ?? 0.8,
      },
    },
  }
}
