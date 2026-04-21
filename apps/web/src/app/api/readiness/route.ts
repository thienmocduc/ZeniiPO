import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { safeUuid } from '@/lib/security/sanitize'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const journeyId = searchParams.get('journey_id')
  if (!journeyId || !safeUuid.safeParse(journeyId).success) {
    return NextResponse.json({ error: 'journey_id required' }, { status: 400 })
  }

  const [criteria, history, score] = await Promise.all([
    supabase
      .from('ipo_readiness_criteria')
      .select('*')
      .eq('journey_id', journeyId)
      .order('category', { ascending: true }),
    supabase
      .from('readiness_score_history')
      .select('*')
      .eq('journey_id', journeyId)
      .order('created_at', { ascending: true }),
    supabase.rpc('compute_readiness_score', { journey_id: journeyId }),
  ])

  if (criteria.error) {
    return NextResponse.json({ error: criteria.error.message }, { status: 500 })
  }

  return NextResponse.json({
    data: {
      criteria: criteria.data ?? [],
      history: history.data ?? [],
      score: score.data ?? null,
    },
  })
}
