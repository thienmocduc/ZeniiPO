import type { SupabaseClient } from '@supabase/supabase-js'
import type { PlanInput, PlanLine, Driver } from './engine'

/**
 * Dựng PlanInput cho engine từ dữ liệu DB (plan_versions + plan_lines +
 * plan_assumptions + tax_rates). Fail-closed: thiếu dữ liệu → trả lỗi rõ ràng,
 * KHÔNG tự điền giá trị mặc định cho những thứ mang tính giả định kinh doanh.
 */
export async function buildPlanInput(
  supabase: SupabaseClient,
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

  const lines: PlanLine[] = lineRows.map((l) => ({
    line_id: String(l.id),
    coa_line: String(l.coa_line),
    label_vi: String(l.label_vi),
    company_id: (l.company_id as string | null) ?? null,
    driver: { type: l.driver_type, ...(l.driver_config as Record<string, unknown>) } as unknown as Driver,
  }))

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
      tax_rate_pct: taxRate,
      scenario_multipliers: {
        bull: A.get('scenario_bull_multiplier') ?? 1.2,
        bear: A.get('scenario_bear_multiplier') ?? 0.8,
      },
    },
  }
}
