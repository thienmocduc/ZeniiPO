import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'
import { isSidecarConfigured, sidecarMonteCarlo } from '@/lib/compute/python-sidecar'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Heavy Monte Carlo proxy → Python sidecar (numpy, handles 100k runs fast).
 * Next.js stays the gateway: auth the user, sign a short JWT, forward.
 * Returns 503 with a clear flag when the sidecar isn't deployed so the
 * client can fall back to the in-process TS engine (/api/financial-model).
 */
const Schema = z.object({
  ar_growth_pct: z.number(),
  churn_pct: z.number().min(0).max(100),
  gross_margin_pct: z.number().min(0).max(100),
  ltv_cac_ratio: z.number().min(0).max(50),
  multiple: z.number().min(0).max(100),
  base_arr_usd: z.number().nonnegative().optional(),
  runs: z.number().int().min(100).max(100_000).optional(),
  seed: z.number().int().optional(),
  journey_id: z.string().uuid().optional(),
})

export async function POST(req: Request) {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  if (!isSidecarConfigured()) {
    return NextResponse.json(
      { error: 'Python sidecar not configured', fallback: '/api/financial-model' },
      { status: 503 },
    )
  }

  const body = await req.json().catch(() => ({}))
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // role for the sidecar JWT
  const { data: profile } = await supabase
    .from('user_profiles').select('role').eq('id', auth.user.id).maybeSingle()

  try {
    const result = await sidecarMonteCarlo(parsed.data, {
      tenant_id: auth.tenantId,
      user_id: auth.user.id,
      role: profile?.role ?? 'chr',
    })
    return NextResponse.json({ data: result, engine: 'python-sidecar' })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'sidecar error', fallback: '/api/financial-model' }, { status: 502 })
  }
}
