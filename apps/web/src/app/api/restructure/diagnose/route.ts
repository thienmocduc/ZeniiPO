import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/restructure/diagnose — CHẨN ĐOÁN TÁI CẤU TRÚC.
 *
 * Dành cho doanh nghiệp ĐANG VẬN HÀNH TỐT muốn chuẩn hoá theo cơ chế công ty
 * niêm yết. Chấm 8 trụ (tài chính · kinh tế đơn vị · quản trị · pháp lý · tổ
 * chức · vận hành · dữ liệu · sẵn sàng vốn) bằng DỮ LIỆU THẬT đã có trong hệ
 * thống — không phải bảng câu hỏi tự khai. Mỗi trụ trả findings + actions.
 *
 * Kết quả lưu restructure_diagnostics để so tiến bộ giữa các lần chấm.
 */
export async function POST() {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const { data, error } = await supabase.rpc('diagnose_restructure', { p_tenant: auth.tenantId })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const r = data as {
    ok: boolean
    overall_score: number
    max_score: number
    grade: string
    pillars: Array<{ key: string; name: string; score: number; max: number; findings: string[]; actions: string[] }>
  }
  if (!r?.ok) return NextResponse.json({ error: 'diagnose failed' }, { status: 500 })

  // Ưu tiên xử lý: trụ nào lệch xa chuẩn nhất thì làm trước.
  const priorities = [...(r.pillars ?? [])]
    .map((p) => ({ ...p, gap: p.max - p.score, gap_pct: p.max > 0 ? Math.round(((p.max - p.score) / p.max) * 100) : 0 }))
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 3)

  const { data: saved } = await supabase
    .from('restructure_diagnostics')
    .insert({
      tenant_id: auth.tenantId,
      pillars: r.pillars,
      overall_score: r.overall_score,
      readiness_gap: priorities,
      created_by: auth.user.id,
    })
    .select('id, created_at')
    .single()

  // So với lần chấm trước để thấy tiến bộ.
  const { data: prev } = await supabase
    .from('restructure_diagnostics')
    .select('overall_score, created_at')
    .order('created_at', { ascending: false })
    .range(1, 1)

  return NextResponse.json({
    data: {
      id: saved?.id ?? null,
      overall_score: r.overall_score,
      max_score: r.max_score,
      grade: r.grade,
      pillars: r.pillars,
      priorities,
      previous: prev?.[0] ?? null,
      delta: prev?.[0] ? Math.round((r.overall_score - Number(prev[0].overall_score)) * 10) / 10 : null,
    },
  })
}
