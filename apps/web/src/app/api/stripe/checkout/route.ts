import { NextResponse } from 'next/server'
import { z } from 'zod'
import Stripe from 'stripe'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentTenantId } from '@/lib/api/tenant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const PLANS = ['explorer', 'pro', 'elite', 'enterprise'] as const
const Schema = z.object({ plan: z.enum(PLANS) })

function priceIdFor(plan: (typeof PLANS)[number]): string | undefined {
  switch (plan) {
    case 'explorer':
      return process.env.STRIPE_PRICE_EXPLORER
    case 'pro':
      return process.env.STRIPE_PRICE_PRO
    case 'elite':
      return process.env.STRIPE_PRICE_ELITE
    case 'enterprise':
      return process.env.STRIPE_PRICE_ENTERPRISE
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = await getCurrentTenantId(supabase, user.id)
  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant for user' }, { status: 403 })
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) {
    return NextResponse.json(
      { error: 'Stripe not configured' },
      { status: 503 },
    )
  }

  const priceId = priceIdFor(parsed.data.plan)
  if (!priceId) {
    return NextResponse.json(
      { error: `No price ID for plan: ${parsed.data.plan}` },
      { status: 500 },
    )
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' as Stripe.LatestApiVersion })

  const origin =
    req.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/billing/cancelled`,
      customer_email: user.email ?? undefined,
      client_reference_id: tenantId,
      metadata: {
        tenant_id: tenantId,
        user_id: user.id,
        plan: parsed.data.plan,
      },
    })

    return NextResponse.json({ data: { id: session.id, url: session.url } })
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? 'Stripe error' },
      { status: 500 },
    )
  }
}
