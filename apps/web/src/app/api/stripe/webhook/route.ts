import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServerClient } from '@/lib/supabase/server'
import { emailBillingReceipt } from '@/lib/email/templates'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Stripe requires the raw body for signature verification.
export async function POST(req: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!stripeKey || !whSecret) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  const sig = req.headers.get('stripe-signature')
  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  const raw = await req.text()
  const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' as Stripe.LatestApiVersion })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(raw, sig, whSecret)
  } catch (err) {
    return NextResponse.json(
      { error: `Signature verification failed: ${(err as Error).message}` },
      { status: 400 },
    )
  }

  const supabase = await createServerClient()

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const tenantId = (sub.metadata?.tenant_id as string | undefined) ?? null
        const plan = (sub.metadata?.plan as string | undefined) ?? null
        const priceId = sub.items.data[0]?.price.id ?? null

        await supabase.from('subscriptions').upsert(
          {
            tenant_id: tenantId,
            stripe_subscription_id: sub.id,
            stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
            price_id: priceId,
            tier_code: plan,
            plan,
            status: sub.status,
            current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            cancel_at_period_end: sub.cancel_at_period_end,
          },
          { onConflict: 'stripe_subscription_id' },
        )
        break
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        await supabase
          .from('subscriptions')
          .update({ status: 'canceled', canceled_at: new Date().toISOString() })
          .eq('stripe_subscription_id', sub.id)
        break
      }
      case 'invoice.payment_succeeded': {
        // Send branded receipt via Resend (no-op if RESEND_API_KEY missing).
        const inv = event.data.object as Stripe.Invoice
        const email = inv.customer_email
        if (email) {
          const subId = (inv as unknown as { subscription?: string }).subscription
          let plan = 'subscription'
          if (subId) {
            const { data: sub } = await supabase
              .from('subscriptions')
              .select('plan, current_period_end')
              .eq('stripe_subscription_id', subId)
              .maybeSingle()
            if (sub?.plan) plan = sub.plan
          }
          await emailBillingReceipt({
            to: email,
            plan,
            amount_usd: (inv.amount_paid ?? 0) / 100,
            period_end: inv.period_end ? new Date(inv.period_end * 1000).toLocaleDateString('vi-VN') : '—',
            invoice_url: inv.hosted_invoice_url ?? undefined,
          })
        }
        break
      }
      default:
        // no-op
        break
    }
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? 'Webhook handler failed' },
      { status: 500 },
    )
  }

  return NextResponse.json({ received: true })
}
