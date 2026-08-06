import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Chế độ vận hành của tenant — quyết định nền tảng phục vụ kiểu nào:
 *   startup     · đi từ ý tưởng lên IPO
 *   restructure · doanh nghiệp ĐANG TỐT, tái cấu trúc theo chuẩn IPO
 *   simulation  · giả lập công ty lớn để tập điều hành
 *   live_ops    · vận hành thật, dữ liệu đấu nối từ hệ thống ngoài
 */

const MODE_GUIDE: Record<string, { title: string; next_steps: string[] }> = {
  startup: {
    title: 'Khởi nghiệp 0 → IPO',
    next_steps: [
      'Điền Business Model Canvas (9 khối) ở trang Milestones',
      'Chạy Council 9 thẩm định ý tưởng',
      'Nhập P&L tháng đầu tiên để mở khoá chuỗi KPI',
    ],
  },
  restructure: {
    title: 'Tái cấu trúc doanh nghiệp đang vận hành',
    next_steps: [
      'Nạp 12-36 tháng P&L lịch sử (nhập tay hoặc đấu nối MISA/Google Sheets)',
      'Chạy Chẩn đoán tái cấu trúc — chấm 8 trụ so chuẩn IPO',
      'Lập sơ đồ tổ chức hiện tại + đối chiếu ghế còn thiếu',
      'Số hoá nghị quyết HĐQT và sổ pháp lý 2-3 năm gần nhất',
    ],
  },
  simulation: {
    title: 'Giả lập điều hành công ty quy mô lớn',
    next_steps: [
      'Đặt quy mô mục tiêu (doanh thu · nhân sự) muốn tập điều hành',
      'Chạy kịch bản giả lập để sinh dòng dữ liệu vận hành',
      'Điều hành theo OKR + KPI như công ty thật, đo bằng chuẩn ngành',
    ],
  },
  live_ops: {
    title: 'Vận hành thật với dữ liệu đấu nối',
    next_steps: [
      'Tạo kết nối dữ liệu (Google Sheets · Larksuite · MISA · zenidigital.io)',
      'Ánh xạ cột nguồn → bảng chuẩn Zeni',
      'Đặt lịch đồng bộ, bật engine agent tự vận hành',
    ],
  },
}

export async function GET() {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const { data } = await supabase
    .from('tenant_operating_profile')
    .select('*')
    .eq('tenant_id', auth.tenantId)
    .maybeSingle()

  const mode = String(data?.mode ?? 'startup')
  return NextResponse.json({
    data: {
      profile: data ?? { tenant_id: auth.tenantId, mode: 'startup', data_source: 'manual' },
      guide: MODE_GUIDE[mode] ?? MODE_GUIDE.startup,
      modes: Object.entries(MODE_GUIDE).map(([k, v]) => ({ mode: k, title: v.title })),
    },
  })
}

const PostSchema = z.object({
  mode: z.enum(['startup', 'restructure', 'simulation', 'live_ops']),
  data_source: z.enum(['manual', 'connected', 'simulated', 'hybrid']).optional(),
  company_stage: z
    .enum(['idea', 'pre_revenue', 'early_revenue', 'growth', 'mature', 'pre_ipo', 'listed'])
    .optional(),
  industry: z.string().trim().max(120).optional(),
  established_year: z.number().int().min(1900).max(2060).optional(),
  baseline_revenue: z.number().finite().optional(),
  baseline_employees: z.number().int().min(0).max(1_000_000).optional(),
  sim_target_revenue: z.number().finite().optional(),
  sim_target_employees: z.number().int().min(0).max(1_000_000).optional(),
  transparency_level: z.enum(['internal', 'investor', 'public']).optional(),
  notes: z.string().trim().max(1000).optional(),
})

export async function POST(req: Request) {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  const parsed = PostSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const patch: Record<string, unknown> = { tenant_id: auth.tenantId, ...parsed.data }
  if (parsed.data.baseline_revenue != null || parsed.data.baseline_employees != null) {
    patch.baseline_captured_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('tenant_operating_profile')
    .upsert(patch, { onConflict: 'tenant_id' })
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: { profile: data, guide: MODE_GUIDE[parsed.data.mode] } }, { status: 201 })
}
