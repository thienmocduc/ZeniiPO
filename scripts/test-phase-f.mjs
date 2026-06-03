#!/usr/bin/env node
/**
 * Phase F — Stripe billing backtest.
 *
 * Without STRIPE_SECRET_KEY in env (production has not been wired yet) the
 * endpoints must:
 *   - GET /api/billing → 200 + {tiers: 5, current_subscription: null}
 *   - POST /api/stripe/checkout → 503 (graceful, not 500)
 *   - POST /api/stripe/portal → 503 (graceful)
 *   - POST /api/stripe/webhook (no signature) → 400 (signature missing)
 *   - All endpoints reject unauthenticated POST with 401
 *   - 5 tiers correctly seeded in DB ($0 / $49 / $499 / $1999 / $4999)
 *   - subscriptions table has the schema migration 011 columns
 *   - /billing/success and /billing/cancelled pages render outside (app)
 */
import { createClient } from '@supabase/supabase-js'
import pg from 'pg'
import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const ROOT = path.resolve(path.dirname(__filename), '..')
dotenv.config({ path: path.join(ROOT, '.env.local') })

const URL_BASE = process.argv.find((a) => a.startsWith('--url='))?.slice(6) || 'http://localhost:3000'
const ADMIN = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const PROJECT_REF = process.env.NEXT_PUBLIC_SUPABASE_URL.match(/\/\/([^.]+)\.supabase\.co/)?.[1]
const COOKIE_NAME = `sb-${PROJECT_REF}-auth-token`

const results = []
const ok = (n, c, d = '') => { results.push({ name: n, pass: c, detail: d }); console.log(`${c ? '✅' : '❌'} ${n}${d ? ' · ' + d : ''}`) }
const sec = (t) => console.log(`\n━━━ ${t} ━━━`)

async function signInGetCookie(email, password) {
  const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  const { data, error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw error
  const payload = JSON.stringify({
    access_token: data.session.access_token, token_type: 'bearer',
    expires_in: data.session.expires_in, expires_at: data.session.expires_at,
    refresh_token: data.session.refresh_token, user: data.session.user,
  })
  return `${COOKIE_NAME}=${encodeURIComponent('base64-' + Buffer.from(payload, 'utf-8').toString('base64'))}`
}

async function call(method, path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers ?? {}) }
  if (opts.cookie) headers['Cookie'] = opts.cookie
  if (method !== 'GET' && method !== 'HEAD') {
    headers['Origin'] = URL_BASE
    headers['Referer'] = `${URL_BASE}/billing`
  }
  const init = { method, headers, redirect: 'manual' }
  if (opts.body) init.body = JSON.stringify(opts.body)
  const r = await fetch(`${URL_BASE}${path}`, init)
  const txt = await r.text()
  let json = null; try { json = JSON.parse(txt) } catch {}
  return { status: r.status, json, text: txt, headers: r.headers }
}

async function main() {
  console.log(`🔬 Phase F · Stripe billing @ ${URL_BASE}\n`)
  const stripeConfigured = !!process.env.STRIPE_SECRET_KEY
  console.log(`STRIPE_SECRET_KEY: ${stripeConfigured ? '✅ configured' : '⚠️  not set (testing graceful fallback)'}\n`)

  const pgC = new pg.Client({ connectionString: process.env.DATABASE_DIRECT_URL, ssl: { rejectUnauthorized: false } })
  await pgC.connect()

  // ─── 1. Membership tiers seeded ─────────────────────────────
  sec('1. membership_tiers seed (5 tiers)')
  const tiers = await pgC.query('SELECT tier_code, name_en, price_usd_month FROM membership_tiers ORDER BY price_usd_month')
  ok('5 tiers in DB', tiers.rows.length === 5, tiers.rows.map((t) => `${t.tier_code}=$${t.price_usd_month}`).join(', '))
  const expectedTiers = ['free', 'explorer', 'pro', 'elite', 'enterprise']
  const tierCodes = tiers.rows.map((t) => t.tier_code)
  ok('  free/explorer/pro/elite/enterprise present', expectedTiers.every((c) => tierCodes.includes(c)))
  ok('  prices match: $0/$49/$499/$1999/$4999', tiers.rows.map((t) => Number(t.price_usd_month)).join(',') === '0,49,499,1999,4999')

  // ─── 2. subscriptions schema (migration 011) ───────────────
  sec('2. subscriptions schema (migration 011 cols)')
  const cols = await pgC.query("SELECT column_name FROM information_schema.columns WHERE table_name='subscriptions' AND table_schema='public'")
  const colNames = cols.rows.map((r) => r.column_name)
  for (const c of ['price_id', 'canceled_at', 'tier_code', 'current_period_start', 'current_period_end', 'cancel_at_period_end', 'tenant_id', 'stripe_customer_id', 'stripe_subscription_id']) {
    ok(`  col · ${c}`, colNames.includes(c))
  }

  // ─── 3. Bootstrap user ──────────────────────────────────────
  sec('3. Bootstrap user')
  const ts = Date.now()
  const u = { email: `phase-f-${ts}@zeniipo-test.example.com`, password: 'PhaseF_2026!Strong' }
  const su = await ADMIN.auth.admin.createUser({
    email: u.email, password: u.password, email_confirm: true,
    user_metadata: { full_name: 'Phase F', company_name: 'Phase F Co', role: 'chr' },
  })
  const userId = su.data?.user?.id
  ok('user created', !!userId)
  await new Promise((r) => setTimeout(r, 1500))
  const cookie = await signInGetCookie(u.email, u.password)

  // ─── 4. /api/billing GET ────────────────────────────────────
  sec('4. /api/billing GET')
  const noAuth = await call('GET', '/api/billing')
  ok('GET (no auth) → 401', noAuth.status === 401)

  const authed = await call('GET', '/api/billing', { cookie })
  ok('GET (auth) → 200', authed.status === 200)
  ok('  data.tiers length=5', authed.json?.data?.tiers?.length === 5)
  ok('  current_subscription null (fresh tenant)', authed.json?.data?.current_subscription === null)

  // ─── 5. /api/stripe/checkout (graceful or live) ────────────
  sec('5. /api/stripe/checkout')
  const checkoutNoAuth = await call('POST', '/api/stripe/checkout', { body: { plan: 'pro' } })
  ok('POST (no auth) → 401 or 403', [401, 403].includes(checkoutNoAuth.status), `status=${checkoutNoAuth.status}`)

  const badPlan = await call('POST', '/api/stripe/checkout', { cookie, body: { plan: 'invalid_tier' } })
  ok('POST bad plan → 400', badPlan.status === 400)

  const checkout = await call('POST', '/api/stripe/checkout', { cookie, body: { plan: 'pro' } })
  if (stripeConfigured) {
    ok('POST valid plan (with key) → 200 + url', checkout.status === 200 && typeof checkout.json?.data?.url === 'string')
  } else {
    ok('POST valid plan (no key) → 503 graceful', checkout.status === 503,
       `status=${checkout.status} err=${JSON.stringify(checkout.json?.error).slice(0, 80)}`)
  }

  // ─── 6. /api/stripe/portal (graceful or live) ──────────────
  sec('6. /api/stripe/portal')
  const portalNoAuth = await call('POST', '/api/stripe/portal')
  ok('POST (no auth) → 401', [401, 403].includes(portalNoAuth.status))

  const portal = await call('POST', '/api/stripe/portal', { cookie })
  if (stripeConfigured) {
    // Without an active subscription → 404
    ok('POST (no sub) → 404', portal.status === 404, `status=${portal.status}`)
  } else {
    ok('POST (no key) → 503 graceful', portal.status === 503, `status=${portal.status}`)
  }

  // ─── 7. /api/stripe/webhook (signature required) ───────────
  sec('7. /api/stripe/webhook signature gate')
  const noSig = await call('POST', '/api/stripe/webhook', { body: { type: 'test' } })
  // 503 when Stripe env not configured (graceful), 400 when configured but no sig.
  const expected = stripeConfigured ? 400 : 503
  ok(`POST no signature → ${expected}`, noSig.status === expected, `status=${noSig.status}`)

  const fakeSig = await call('POST', '/api/stripe/webhook', {
    headers: { 'stripe-signature': 'fake_sig_v1' },
    body: { type: 'test' },
  })
  // With an invalid signature, Stripe SDK throws → 500 (no key) or 400 (key + bad sig).
  ok('POST fake signature → 4xx/5xx (rejected)', fakeSig.status >= 400, `status=${fakeSig.status}`)

  // ─── 8. /billing/success and /billing/cancelled pages ──────
  sec('8. /billing/success + /billing/cancelled pages')
  const success = await call('GET', '/billing/success?session_id=cs_test_xxx')
  ok('GET /billing/success → 200', success.status === 200)
  ok('  contains "Thanh toán thành công"', success.text.includes('Thanh toán thành công'))

  const cancelled = await call('GET', '/billing/cancelled')
  ok('GET /billing/cancelled → 200', cancelled.status === 200)
  ok('  contains "huỷ"', success.text.length > 0 && cancelled.text.toLowerCase().includes('huỷ'))

  // ─── 9. Security headers on /billing pages ────────────────
  sec('9. Security headers')
  ok('  /billing/success X-Frame-Options DENY', success.headers.get('x-frame-options')?.includes('DENY'))
  ok('  /billing/cancelled CSP frame-ancestors none', cancelled.headers.get('content-security-policy')?.includes("frame-ancestors 'none'"))

  // ─── 10. RLS on subscriptions ──────────────────────────────
  sec('10. subscriptions RLS isolation')
  const policies = await pgC.query("SELECT polname FROM pg_policy WHERE polrelid='public.subscriptions'::regclass")
  ok('subscriptions has tenant_isolation policy', policies.rows.some((p) => p.polname === 'tenant_isolation'))
  ok('subscriptions has super_admin_bypass policy', policies.rows.some((p) => p.polname === 'super_admin_bypass'))

  // ─── Cleanup ──────────────────────────────────────────────
  sec('Cleanup')
  await ADMIN.auth.admin.deleteUser(userId)
  await pgC.end()
  console.log('🧹 cleaned up')

  const passCount = results.filter((r) => r.pass).length
  const failCount = results.filter((r) => !r.pass).length
  console.log('\n╔══════════════════════════════════════════════════════════════════╗')
  console.log(`║ PHASE F · ${passCount}/${passCount + failCount} pass · ${failCount === 0 ? '✅ ALL GREEN' : `❌ ${failCount} FAIL`}${' '.repeat(Math.max(0, 32 - String(passCount + failCount).length - String(failCount).length))}║`)
  console.log('╚══════════════════════════════════════════════════════════════════╝')
  if (failCount > 0) {
    console.log('\nFailed:')
    for (const r of results.filter((r) => !r.pass)) console.log(`  ❌ ${r.name} · ${r.detail}`)
  }
  process.exit(failCount === 0 ? 0 : 1)
}

main().catch((e) => { console.error('💥', e); process.exit(2) })
