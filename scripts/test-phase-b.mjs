#!/usr/bin/env node
/**
 * Phase B — API endpoints backtest.
 *
 * Verifies all 30+ API routes against a live dev server (default) or any
 * URL passed via --url=. Uses real Supabase signUp + sign-in for auth so
 * RLS, tenant scope and role gates run end-to-end.
 *
 * Spins up its own throwaway tenant (User A) and a second tenant (User B)
 * to verify cross-tenant isolation. Cleans both up at the end.
 */
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const ROOT = path.resolve(path.dirname(__filename), '..')
dotenv.config({ path: path.join(ROOT, '.env.local') })

const URL_BASE = process.argv.find((a) => a.startsWith('--url='))?.slice(6) || 'http://localhost:3000'
const ADMIN = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const SB = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

const results = []
const ok = (n, c, d = '') => {
  results.push({ name: n, pass: c, detail: d })
  console.log(`${c ? '✅' : '❌'} ${n}${d ? ' · ' + d : ''}`)
}
const sec = (t) => console.log(`\n━━━ ${t} ━━━`)

const ts = Date.now()
const userA = { email: `phase-b-a-${ts}@zeniipo-test.local`, password: 'PhaseB_A_2026!Strong' }
const userB = { email: `phase-b-b-${ts}@zeniipo-test.local`, password: 'PhaseB_B_2026!Strong' }
let cookieA = ''
let cookieB = ''

// @supabase/ssr stores the session in a cookie named `sb-{ref}-auth-token` whose
// value is a URI-encoded base64-prefixed JSON array (or chunked across .0 .1 ...
// when too large). We replicate that encoding so server route handlers — which
// read cookies via createServerClient — accept us as a logged-in user.
const PROJECT_REF = process.env.NEXT_PUBLIC_SUPABASE_URL.match(/\/\/([^.]+)\.supabase\.co/)?.[1]
const COOKIE_NAME = `sb-${PROJECT_REF}-auth-token`

async function signInGetCookie(email, password) {
  const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  const { data, error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw error
  const session = data.session
  // The format @supabase/ssr writes into the cookie store:
  //   `base64-${base64(JSON.stringify({ access_token, refresh_token, ... }))}`
  // The wrapper functions in @supabase/ssr handle chunking transparently if
  // the cookie exceeds ~3.6KB, but for our test users it always fits.
  const payload = JSON.stringify({
    access_token: session.access_token,
    token_type: 'bearer',
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    refresh_token: session.refresh_token,
    user: session.user,
  })
  const value = 'base64-' + Buffer.from(payload, 'utf-8').toString('base64')
  return `${COOKIE_NAME}=${encodeURIComponent(value)}`
}

async function call(method, path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers ?? {}) }
  if (opts.cookie) headers['Cookie'] = opts.cookie
  // Origin header so CSRF middleware accepts state-changing requests from
  // this Node-based test harness as same-origin.
  if (method !== 'GET' && method !== 'HEAD') {
    headers['Origin'] = URL_BASE
    headers['Referer'] = `${URL_BASE}/dashboard`
  }
  const init = { method, headers, redirect: opts.redirect ?? 'manual' }
  if (opts.body) init.body = JSON.stringify(opts.body)
  return fetch(`${URL_BASE}${path}`, init)
}

async function callJson(method, path, opts = {}) {
  const r = await call(method, path, opts)
  let json = null
  try { json = await r.json() } catch { /* */ }
  return { status: r.status, json }
}

async function main() {
  console.log(`🔬 Phase B · API endpoints backtest @ ${URL_BASE}`)

  // ─── 1. Public endpoints (no auth) ─────────────────────────
  sec('1. Public endpoints')
  for (const path of ['/', '/login', '/signup', '/api/health', '/api/modules', '/api/glossary']) {
    const r = await call('GET', path, { redirect: 'follow' })
    ok(`GET ${path} → 200`, r.status === 200, `status=${r.status}`)
  }

  // ─── 2. Auth gate (no session → 401/redirect) ──────────────
  sec('2. Auth gate enforcement')
  const protectedApis = [
    '/api/dashboard', '/api/onboarding/status', '/api/board', '/api/team',
    '/api/billing', '/api/burn', '/api/unit-metrics', '/api/forecast',
    '/api/sensitivity', '/api/sales', '/api/valuation', '/api/vault', '/api/pitch',
    '/api/dataflow', '/api/workflow', '/api/audit', '/api/admin', '/api/settings',
    '/api/comparables', '/api/market-data', '/api/market-intel', '/api/feedback',
    '/api/tokenomics', '/api/investors', '/api/nlq',
  ]
  for (const path of protectedApis) {
    const r = await call('GET', path)
    ok(`GET ${path} (no auth) → 401`, r.status === 401, `status=${r.status}`)
  }

  // ─── 3. Bootstrap test users ───────────────────────────────
  sec('3. Bootstrap test users')
  const su1 = await ADMIN.auth.admin.createUser({
    email: userA.email, password: userA.password, email_confirm: true,
    user_metadata: { full_name: 'Phase B A', company_name: 'Phase B Co A', role: 'chr' },
  })
  ok('User A created', !su1.error && !!su1.data?.user, su1.error?.message ?? `id ${su1.data?.user?.id?.slice(0, 8)}`)
  const su2 = await ADMIN.auth.admin.createUser({
    email: userB.email, password: userB.password, email_confirm: true,
    user_metadata: { full_name: 'Phase B B', company_name: 'Phase B Co B', role: 'chr' },
  })
  ok('User B created', !su2.error && !!su2.data?.user, su2.error?.message ?? `id ${su2.data?.user?.id?.slice(0, 8)}`)
  const userIdA = su1.data?.user?.id
  const userIdB = su2.data?.user?.id

  // wait for trigger to complete
  await new Promise((r) => setTimeout(r, 2000))

  cookieA = await signInGetCookie(userA.email, userA.password)
  cookieB = await signInGetCookie(userB.email, userB.password)
  ok('User A cookie obtained', cookieA.length > 100, `${cookieA.length} chars`)
  ok('User B cookie obtained', cookieB.length > 100, `${cookieB.length} chars`)

  // Pre-create a journey for User A so endpoints that need it return data.
  const { data: profileA } = await ADMIN.from('user_profiles').select('tenant_id').eq('id', userIdA).single()
  const tenantA = profileA?.tenant_id
  ok('User A tenant resolved via service role', !!tenantA, tenantA?.slice(0, 8))
  const cas = await SB.rpc('cascade_chairman_event', {
    p_tenant_id: tenantA, p_valuation: 5_000_000, p_venue: 'sgx', p_year: 2031, p_industry: 'biotech', p_strategy: 'phase B',
  })
  ok('Phase B journey created', !cas.error && cas.data?.status === 'success', cas.error?.message)

  // ─── 4. GET endpoints with User A auth ─────────────────────
  sec('4. Authenticated GET endpoints')
  const authGets = [
    '/api/dashboard', '/api/onboarding/status', '/api/board', '/api/team',
    '/api/billing', '/api/burn', '/api/unit-metrics', '/api/forecast',
    '/api/sensitivity', '/api/sales', '/api/valuation', '/api/vault', '/api/pitch',
    '/api/dataflow', '/api/workflow', '/api/audit', '/api/settings',
    '/api/comparables', '/api/market-data', '/api/market-intel', '/api/feedback',
    '/api/tokenomics', '/api/investors',
  ]
  for (const path of authGets) {
    const { status, json } = await callJson('GET', path, { cookie: cookieA })
    const looksGood = status === 200 && json && (json.data !== undefined || json.error == null)
    ok(`GET ${path} (auth) → 200 + data`, looksGood, `status=${status}${json?.error ? ' err=' + JSON.stringify(json.error).slice(0, 60) : ''}`)
  }

  // ─── 5. /api/admin role gate (chairman_super only) ─────────
  sec('5. /api/admin role gate')
  const adminRes = await call('GET', '/api/admin', { cookie: cookieA })
  ok('GET /api/admin (non-super) → 403', adminRes.status === 403, `status=${adminRes.status}`)

  // ─── 6. /api/audit/export role gate ────────────────────────
  sec('6. /api/audit/export role gate')
  // User A is 'chr' which IS allowed. We assert 200 + CSV.
  const expRes = await call('GET', '/api/audit/export?limit=10', { cookie: cookieA })
  const isCsv = expRes.headers.get('content-type')?.includes('text/csv')
  ok('GET /api/audit/export (chr) → CSV', expRes.status === 200 && isCsv, `status=${expRes.status} ct=${expRes.headers.get('content-type')}`)

  // ─── 7. POST CRUD endpoints (insert + tenant scope) ────────
  sec('7. POST CRUD endpoints (User A)')
  const inserts = [
    { path: '/api/comparables', body: { company_name: 'Phase B Comp', industry: 'biotech', revenue_usd: 1000000 } },
    { path: '/api/market-data', body: { metric_type: 'tam', region: 'SEA', value_numeric: 5_000_000_000, value_unit: 'USD' } },
    { path: '/api/market-intel', body: { category: 'competitor', severity: 'watch', title: 'Phase B Test Signal' } },
    { path: '/api/feedback', body: { category: 'feature_request', severity: 'low', title: 'Phase B Test Feedback' } },
    { path: '/api/tokenomics', body: { token_symbol: 'PBT', pool_name: 'Test Pool', allocation_pct: 25 } },
    { path: '/api/investors', body: { investor_name: 'Phase B VC', stage: 'soft_commit', target_check_usd: 500000 } },
  ]
  const insertedIds = {}
  for (const { path, body } of inserts) {
    const { status, json } = await callJson('POST', path, { token: cookieA, body })
    const inserted = (status === 201 || status === 200) && json?.data?.id
    ok(`POST ${path} → 201`, !!inserted, `status=${status}${json?.error ? ' err=' + JSON.stringify(json.error).slice(0, 80) : ''}`)
    if (inserted) insertedIds[path] = json.data.id
  }

  // ─── 8. Cross-tenant RLS isolation ─────────────────────────
  sec('8. Cross-tenant RLS isolation')
  // User B should NOT see User A's inserted comparable
  const compB = await callJson('GET', '/api/comparables', { cookie: cookieB })
  const sawA = (compB.json?.data ?? []).some((c) => c.id === insertedIds['/api/comparables'])
  ok('User B cannot see User A comparables', !sawA, `B.count=${compB.json?.data?.length ?? '?'} sawA=${sawA}`)

  const invB = await callJson('GET', '/api/investors', { cookie: cookieB })
  const sawAInv = (invB.json?.data ?? []).some((i) => i.id === insertedIds['/api/investors'])
  ok('User B cannot see User A investors', !sawAInv, `B.count=${invB.json?.data?.length ?? '?'} sawA=${sawAInv}`)

  // ─── 9. Schema validation (bad body → 400) ─────────────────
  sec('9. Schema validation')
  const badBodies = [
    { path: '/api/comparables', body: {}, name: 'comparables · missing company_name' },
    { path: '/api/market-data', body: { metric_type: 'invalid_type' }, name: 'market-data · enum' },
    { path: '/api/market-intel', body: { category: 'random', title: 'x' }, name: 'market-intel · enum' },
    { path: '/api/tokenomics', body: { token_symbol: 'X', pool_name: 'Y', allocation_pct: 200 }, name: 'tokenomics · pct >100' },
  ]
  for (const { path, body, name } of badBodies) {
    const { status } = await callJson('POST', path, { token: cookieA, body })
    ok(`POST ${path} bad body → 400 (${name})`, status === 400, `status=${status}`)
  }

  // ─── 10. NLQ guard (no ANTHROPIC key → 503) ───────────────
  sec('10. NLQ guard')
  const nlqRes = await callJson('POST', '/api/nlq', { token: cookieA, body: { query_text: 'show me top 5 investors by check size' } })
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY
  if (hasAnthropic) {
    ok('POST /api/nlq (with key) → 200/422', [200, 422].includes(nlqRes.status), `status=${nlqRes.status}`)
  } else {
    ok('POST /api/nlq (no key) → 503', nlqRes.status === 503, `status=${nlqRes.status}`)
  }

  // ─── 11. Cron auth gate ────────────────────────────────────
  sec('11. Cron auth gate')
  for (const path of ['/api/cron/audit-retention', '/api/cron/readiness-recalc', '/api/cron/weekly-digest']) {
    const r = await call('GET', path)
    ok(`GET ${path} (no header) → 403`, r.status === 403, `status=${r.status}`)
  }
  // With CRON_SECRET (if set)
  if (process.env.CRON_SECRET) {
    const r = await call('GET', '/api/cron/audit-retention', {
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    })
    ok('GET /api/cron/audit-retention (with secret) → 200', r.status === 200, `status=${r.status}`)
  }

  // ─── 12. Cleanup ───────────────────────────────────────────
  sec('Cleanup')
  if (userIdA) await ADMIN.auth.admin.deleteUser(userIdA)
  if (userIdB) await ADMIN.auth.admin.deleteUser(userIdB)
  console.log('🧹 cleaned up test users')

  // ─── Summary ───────────────────────────────────────────────
  const passCount = results.filter((r) => r.pass).length
  const failCount = results.filter((r) => !r.pass).length
  console.log('\n╔══════════════════════════════════════════════════════════════════╗')
  console.log(`║ PHASE B · ${passCount}/${passCount + failCount} pass · ${failCount === 0 ? '✅ ALL GREEN' : `❌ ${failCount} FAIL`}${' '.repeat(Math.max(0, 30 - String(passCount + failCount).length))}║`)
  console.log('╚══════════════════════════════════════════════════════════════════╝')
  if (failCount > 0) {
    console.log('\nFailed:')
    for (const r of results.filter((r) => !r.pass)) console.log(`  ❌ ${r.name} · ${r.detail}`)
  }
  process.exit(failCount === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('\n💥 Fatal:', e)
  process.exit(2)
})
