import type { ZeniClient } from '@/lib/zeni/compat'

/**
 * Context builder — assembles the compact tenant snapshot a supagent needs
 * for one autonomous cycle. Every query is fault-tolerant: a missing table
 * or column degrades to an empty section instead of failing the run (the
 * engine runs across heterogeneous tenants + evolving schema).
 *
 * Kept intentionally small (~2-3k tokens) so 12 chiefs/tenant/cycle stay
 * cheap. Department-specific extras can be layered in later phases.
 */

export type TenantSnapshot = {
  tenant: { id: string; name?: string }
  journey?: Record<string, unknown> | null
  readiness_score?: number | null
  readiness_breakdown?: unknown
  kpis: Array<Record<string, unknown>>
  okrs: Array<Record<string, unknown>>
  tasks_summary: Record<string, number>
  stale_tasks: Array<Record<string, unknown>>
  recent_feedback: Array<Record<string, unknown>>
  recent_memory: Array<Record<string, unknown>>
}

async function safeRows(
  q: PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<Array<Record<string, unknown>>> {
  try {
    const { data, error } = await q
    if (error || !Array.isArray(data)) return []
    return data as Array<Record<string, unknown>>
  } catch {
    return []
  }
}

export async function buildTenantSnapshot(
  sb: ZeniClient,
  tenantId: string,
  agentCode: string,
): Promise<TenantSnapshot> {
  const [tenantRows, journeyRows, diemRows, kpis, okrs, tasks, feedback, memory] = await Promise.all([
    safeRows(sb.from('tenants').select('id, name').eq('id', tenantId).limit(1)),
    // Điểm sẵn sàng IPO — `playbooks.ts` bảo agent lấy `readiness_score` làm
    // chỉ số trọng tâm, nhưng ảnh chụp trước đây không hề có số đó (nó bị lấy
    // nhầm từ một cột không tồn tại trên ipo_journeys). Lấy đúng nguồn:
    // bản ghi mới nhất của readiness_score_history.
    safeRows(
      sb
        .from('readiness_score_history')
        .select('total_score, breakdown_by_category, captured_at')
        .eq('tenant_id', tenantId)
        .order('captured_at', { ascending: false })
        .limit(1),
    ),
    safeRows(
      sb
        .from('ipo_journeys')
        // ⚠ `readiness_score` KHÔNG phải cột của ipo_journeys — điểm sẵn sàng
        // nằm ở `readiness_score_history` và tính bằng compute_readiness_score.
        // Để nó ở đây làm CẢ câu truy vấn hỏng, nên ảnh chụp doanh nghiệp nạp
        // cho agent luôn rỗng phần hành trình IPO.
        .select('current_phase, north_star_metric, valuation_target, target_year, status')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .limit(1),
    ),
    safeRows(
      sb
        .from('kpi_metrics')
        // ⚠ Cột thời gian của kpi_metrics là `captured_at`, không phải
        // `created_at`. Sai tên ⇒ Postgres trả lỗi ⇒ agent không đọc được MỘT
        // chỉ số nào.
        .select('metric_code, name, value, unit, period, trend, captured_at')
        .eq('tenant_id', tenantId)
        .order('captured_at', { ascending: false })
        .limit(16),
    ),
    safeRows(
      sb
        .from('okr_objectives')
        .select('title, status, progress, quarter')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(8),
    ),
    safeRows(
      sb
        .from('tasks')
        .select('title, status, priority, due_date, agent_generated, created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(40),
    ),
    safeRows(
      sb
        .from('feedback_items')
        .select('category, severity, title, created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(8),
    ),
    safeRows(
      sb
        .from('agent_memory')
        .select('kind, title, body, created_at')
        .eq('tenant_id', tenantId)
        .eq('agent_code', agentCode)
        .order('created_at', { ascending: false })
        .limit(5),
    ),
  ])

  const tasks_summary: Record<string, number> = {}
  for (const t of tasks) {
    const s = String(t.status ?? 'unknown')
    tasks_summary[s] = (tasks_summary[s] ?? 0) + 1
  }
  const now = Date.now()
  const stale_tasks = tasks
    .filter((t) => {
      if (t.status === 'done') return false
      const created = t.created_at ? Date.parse(String(t.created_at)) : now
      return t.status === 'blocked' || now - created > 14 * 24 * 3600 * 1000
    })
    .slice(0, 8)
    .map((t) => ({ title: t.title, status: t.status, priority: t.priority, due_date: t.due_date }))

  return {
    tenant: { id: tenantId, name: tenantRows[0]?.name as string | undefined },
    journey: journeyRows[0] ?? null,
    // Có thể null thật: chưa ai chạy tính điểm lần nào. Để null cho agent biết
    // là CHƯA CÓ, đừng thay bằng 0 — 0 nghĩa là "đã tính và bằng 0", khác hẳn.
    readiness_score: (diemRows[0]?.total_score as number | undefined) ?? null,
    readiness_breakdown: diemRows[0]?.breakdown_by_category ?? null,
    kpis,
    okrs,
    tasks_summary,
    stale_tasks,
    recent_feedback: feedback,
    recent_memory: memory,
  }
}
