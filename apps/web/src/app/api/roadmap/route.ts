import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/roadmap — bản đồ 10 bước Idea → IPO với GATE TÍNH TỪ DỮ LIỆU THẬT.
 *
 * Mỗi bước trong journey_phase_specs có gates [{key,label}]; route này chấm
 * từng gate bằng dữ liệu thật của tenant (canvas, council, market, P&L, OKR,
 * SOP, agents, board, data room, readiness) — không có số bịa. Bước hiện tại
 * lấy từ ipo_journeys.current_phase (1-10).
 */

type Rows = Array<Record<string, unknown>>
/**
 * Lấy dữ liệu, lỗi thì trả mảng rỗng — nhưng PHẢI GHI LẠI.
 *
 * Bản trước nuốt lỗi hoàn toàn. Hai truy vấn trong số này trỏ vào bảng KHÔNG
 * TỒN TẠI (`modules`, `governance_docs`), nên hai cổng chấm điểm SOP và quản
 * trị **luôn bằng 0** suốt từ ngày viết — mà không một dòng lỗi nào hiện ra.
 * Hỏng âm thầm tệ hơn hỏng ồn ào: điểm sẵn sàng IPO thấp mà không ai biết vì
 * sao thấp.
 */
const safe = (r: { data: unknown; error: unknown }, ten: string): Rows => {
  if (r.error) {
    console.error(
      `[roadmap] cổng "${ten}" không đọc được dữ liệu ⇒ bị chấm 0 điểm:`,
      (r.error as { message?: string })?.message ?? r.error,
    )
    return []
  }
  return Array.isArray(r.data) ? (r.data as Rows) : []
}

export async function GET() {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const [specsR, journeyR, canvasR, councilR, mktR, intelR, finR, okrR, sopR, schedR, boardR, govR, vaultR, readyR, roundsR, kpiR] =
    await Promise.all([
      supabase.from('journey_phase_specs').select('*').order('phase'),
      supabase.from('ipo_journeys').select('id, current_phase, north_star_metric, valuation_target, target_year, status').eq('status', 'active').limit(1),
      supabase.from('canvas_blocks').select('block_key, items'),
      supabase.from('events').select('id').eq('event_type', 'council_validation').limit(5),
      supabase.from('market_data').select('metric_type').limit(50),
      supabase.from('market_intel').select('id').limit(10),
      supabase.from('financial_statements').select('period, revenue, cogs').order('created_at', { ascending: false }).limit(12),
      supabase.from('okr_objectives').select('id').limit(5),
      // Bảng `modules` KHÔNG tồn tại (tên thật là `modules_catalog`, và nó là
      // danh mục module chứ không phải quy trình). Quy trình vận hành nằm ở
      // `sop_processes` — đó mới là thứ cổng SOP phải đếm.
      supabase.from('sop_processes').select('id').eq('status', 'active').limit(3),
      supabase.from('agent_schedules').select('id').eq('enabled', true).limit(3),
      supabase.from('user_profiles').select('id, role').in('role', ['chr', 'ceo', 'board', 'investor']).limit(20),
      // `governance_docs` KHÔNG có trong lược đồ. Bằng chứng quản trị thật là
      // nghị quyết hội đồng quản trị.
      supabase.from('board_resolutions').select('id').limit(3),
      supabase.from('data_room_docs').select('id').limit(5),
      supabase.from('readiness_score_history').select('total_score, captured_at').order('captured_at', { ascending: false }).limit(1),
      supabase.from('fundraise_rounds').select('status, target_raise_usd').limit(20),
      supabase.from('kpi_metrics').select('metric_code, value, period').eq('category', 'finance_derived').order('captured_at', { ascending: false }).limit(20),
    ])

  const specs = safe(specsR, 'giai đoạn hành trình')
  if (specsR.error || specs.length === 0) {
    return NextResponse.json(
      { error: specsR.error ? (specsR.error as { message?: string }).message : 'journey_phase_specs trống — apply migration 025' },
      { status: 500 },
    )
  }
  const journey = safe(journeyR, 'hành trình')[0] ?? null
  const currentPhase = Number(journey?.current_phase ?? 1)

  const canvasFilled = safe(canvasR, 'mô hình kinh doanh').filter((b) => Array.isArray(b.items) && (b.items as unknown[]).length > 0).length
  const councilRuns = safe(councilR, 'hội đồng thẩm định').length
  const mktTypes = new Set(safe(mktR, 'dữ liệu thị trường').map((m) => m.metric_type as string))
  const intelCount = safe(intelR, 'tin tức thị trường').length
  const finRows = safe(finR, 'báo cáo tài chính')
  const hasRevenue = finRows.some((f) => Number(f.revenue) > 0)
  const latestFin = finRows[0]
  const gmPositive = latestFin ? Number(latestFin.revenue) - Number(latestFin.cogs) > 0 && Number(latestFin.revenue) > 0 : false
  const okrCount = safe(okrR, 'mục tiêu OKR').length
  const sopCount = safe(sopR, 'quy trình vận hành').length
  const agentsOn = safe(schedR, 'lịch chạy trợ lý').length
  const boardCount = safe(boardR, 'thành viên hội đồng').filter((b) => /board|chr/i.test(String(b.role))).length
  const govCount = safe(govR, 'nghị quyết quản trị').length
  const vaultDocs = safe(vaultR, 'phòng dữ liệu').length
  const readiness = Number(safe(readyR, 'điểm sẵn sàng')[0]?.total_score ?? 0)
  const rounds = safe(roundsR, 'vòng gọi vốn')
  const OPEN = ['planning', 'outreach', 'negotiating', 'term_sheet', 'due_diligence']
  const openRounds = rounds.filter((r) => OPEN.includes(String(r.status)))
  const kpis = safe(kpiR, 'chỉ số tài chính')
  const kpiVal = (code: string) => {
    const row = kpis.find((k) => k.metric_code === code)
    return row ? Number(row.value) : null
  }
  const growth = kpiVal('growth_mom_pct')
  const runway = kpiVal('runway_months')

  // Chấm từng gate key bằng dữ liệu thật.
  const GATE_EVAL: Record<string, boolean> = {
    canvas_5_blocks: canvasFilled >= 5,
    council_run: councilRuns > 0,
    market_sized: mktTypes.has('tam') && mktTypes.has('sam') && mktTypes.has('som'),
    signals: intelCount >= 3,
    first_revenue: hasRevenue,
    finstat_3m: finRows.length >= 3,
    growth_positive: growth != null && growth > 0,
    okr_active: okrCount > 0,
    sops: sopCount > 0,
    agents_on: agentsOn > 0,
    gm_positive: gmPositive,
    runway_9m: (runway != null && runway >= 9) || openRounds.length > 0,
    round_linked: openRounds.length > 0,
    board: boardCount > 0,
    gov_docs: govCount > 0,
    dataroom: vaultDocs > 0,
    readiness_70: readiness >= 70,
    readiness_85: readiness >= 85,
    valuation: journey?.valuation_target != null,
    listed: currentPhase >= 10,
  }

  const phases = specs.map((s) => {
    const gates = ((s.gates as Array<{ key: string; label: string }>) ?? []).map((g) => ({
      ...g,
      pass: GATE_EVAL[g.key] ?? false,
    }))
    const phaseNum = Number(s.phase)
    return {
      phase: phaseNum,
      title: s.title,
      mission: s.mission,
      key_metrics: s.key_metrics,
      dashboard_focus: s.dashboard_focus,
      gates,
      gates_passed: gates.filter((g) => g.pass).length,
      gates_total: gates.length,
      status: phaseNum < currentPhase ? 'done' : phaseNum === currentPhase ? 'current' : 'upcoming',
    }
  })

  return NextResponse.json({
    data: {
      journey: journey
        ? { current_phase: currentPhase, north_star_metric: journey.north_star_metric, valuation_target: journey.valuation_target, target_year: journey.target_year }
        : null,
      phases,
      snapshot: { canvasFilled, councilRuns, finMonths: finRows.length, readiness, openRounds: openRounds.length, runway, growth },
    },
  })
}
