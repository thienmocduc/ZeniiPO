import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/academy?level=N — lessons + assessment (answers stripped) +
// deliverable specs for a level. Curriculum is global; auth still required so
// only logged-in founders consume it.
export async function GET(req: Request) {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const url = new URL(req.url)
  const level = Number(url.searchParams.get('level') ?? '1')
  if (!Number.isInteger(level) || level < 1 || level > 7) {
    return NextResponse.json({ error: 'level must be 1–7' }, { status: 400 })
  }

  const [lessons, assessment, specs] = await Promise.all([
    supabase.from('academy_lessons').select('lesson_code, order_idx, title_vi, title_en, analogy_vi, body_vi, takeaway_vi')
      .eq('level_num', level).eq('status', 'published').order('order_idx', { ascending: true }),
    supabase.from('academy_assessments').select('pass_mark, total, questions').eq('level_num', level).maybeSingle(),
    supabase.from('academy_deliverable_specs').select('code, label_vi, entity, hint_vi').eq('level_num', level),
  ])
  if (lessons.error) return NextResponse.json({ error: lessons.error.message }, { status: 500 })

  // Strip correct answers before sending to the client (anti-cheat).
  const quiz = assessment.data
    ? {
        pass_mark: assessment.data.pass_mark,
        total: assessment.data.total,
        questions: (assessment.data.questions as Array<{ id: string; q: string; options: string[] }>).map((q) => ({
          id: q.id, q: q.q, options: q.options,
        })),
      }
    : null

  return NextResponse.json({
    data: { level, lessons: lessons.data ?? [], assessment: quiz, deliverables: specs.data ?? [] },
  })
}
