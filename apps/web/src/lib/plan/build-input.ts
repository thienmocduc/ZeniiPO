import type { ZeniClient } from '@/lib/zeni/compat'
import type { PlanInput, PlanLine, Driver } from './engine'

/**
 * DÃ¡Â»Â±ng PlanInput cho engine tÃ¡Â»Â« dÃ¡Â»Â¯ liÃ¡Â»â€¡u DB (plan_versions + plan_lines +
 * plan_assumptions + tax_rates). Fail-closed: thiÃ¡ÂºÂ¿u dÃ¡Â»Â¯ liÃ¡Â»â€¡u Ã¢â€ â€™ trÃ¡ÂºÂ£ lÃ¡Â»â€”i rÃƒÂµ rÃƒÂ ng,
 * KHÃƒâ€NG tÃ¡Â»Â± Ã„â€˜iÃ¡Â»Ân giÃƒÂ¡ trÃ¡Â»â€¹ mÃ¡ÂºÂ·c Ã„â€˜Ã¡Â»â€¹nh cho nhÃ¡Â»Â¯ng thÃ¡Â»Â© mang tÃƒÂ­nh giÃ¡ÂºÂ£ Ã„â€˜Ã¡Â»â€¹nh kinh doanh.
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
  if (!version) return { ok: false, error: 'KhÃƒÂ´ng tÃƒÂ¬m thÃ¡ÂºÂ¥y plan version' }

  const { data: lineRows } = await supabase
    .from('plan_lines')
    .select('id, coa_line, label_vi, company_id, driver_type, driver_config')
    .eq('plan_version_id', versionId)
  if (!lineRows || lineRows.length === 0) {
    return {
      ok: false,
      error: 'KÃ¡ÂºÂ¿ hoÃ¡ÂºÂ¡ch chÃ†Â°a cÃƒÂ³ dÃƒÂ²ng nÃƒÂ o Ã¢â‚¬â€ thÃƒÂªm dÃƒÂ²ng doanh thu/chi phÃƒÂ­ (bÃ¡ÂºÂ¯t buÃ¡Â»â„¢c gÃ¡ÂºÂ¯n mÃƒÂ£ COA VAS).',
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

  // ThuÃ¡ÂºÂ¿ suÃ¡ÂºÂ¥t theo hiÃ¡Â»â€¡u lÃ¡Â»Â±c Ã¢â‚¬â€ lÃ¡ÂºÂ¥y tÃ¡Â»Â« bÃ¡ÂºÂ£ng cÃ¡ÂºÂ¥u hÃƒÂ¬nh (spec: khÃƒÂ´ng hardcode).
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
