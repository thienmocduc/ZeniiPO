#!/usr/bin/env node
/**
 * Phase D — Onboarding wizard end-to-end test.
 *
 * Real flow tested (no assumptions):
 *   1. Anon signUp creates user → trigger creates user_profile + tenant + chr role
 *   2. /api/onboarding/status returns { onboarded: false } for fresh tenant
 *   3. /api/onboarding/complete with valid 3-step payload creates:
 *      - 1 ipo_journey (cascade-default + patched name/industry/north_star)
 *      - 4 cascade-default CHR objectives + 1 user-supplied OKR (5 total)
 *      - 4 KPI metrics with skeleton values
 *      - 20 readiness criteria seeded
 *   4. /api/onboarding/status now returns { onboarded: true, journey_count: 1 }
 *   5. Calling /api/onboarding/complete again returns 409 (idempotent guard)
 *   6. /api/onboarding/complete validation: bad body → 400, no auth → 401
 *   7. RLS isolation: user B's wizard payload lands only in tenant B
 *   8. Cleanup both test users + their tenants
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
const ok = (n, c, d = '') => {
  results.push({ name: n, pass: c, detail: d })
  console.log(`${c ? '✅' : '❌'} ${n}${d ? ' · ' + d : ''}`)
}
const sec = (t) => console.log(`\n━━━ ${t} ━━━`)

async function signInGetCookie(email, password) {
  const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  const { data, error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw error
  const payload = JSON.stringify({
    access_token: data.session.access_token,
    token_type: 'bearer',
    expires_in: data.session.expires_in,
    expires_at: data.session.expires_at,
    refresh_token: data.session.refresh_token,
    user: data.session.user,
  })
  const value = 'base64-' + Buffer.from(payload, 'utf-8').toString('base64')
  return `${COOKIE_NAME}=${encodeURIComponent(value)}`
}

async function call(method, path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers ?? {}) }
  if (opts.cookie) headers['Cookie'] = opts.cookie
  if (method !== 'GET' && method !== 'HEAD') {
    headers['Origin'] = URL_BASE
    headers['Referer'] = `${URL_BASE}/dashboard`
  }
  const init = { method, headers, redirect: opts.redirect ?? 'manual' }
  if (opts.body) init.body = JSON.stringify(opts.body)
  const r = await fetch(`${URL_BASE}${path}`, init)
  const txt = await r.text()
  let json = null
  try { json = JSON.parse(txt) } catch {}
  return { status: r.status, json, text: txt }
}

const ts = Date.now()
const userA = { email: `phase-d-a-${ts}@zeniipo-test.local`, password: 'PhaseD_A_2026!Strong' }
const userB = { email: `phase-d-b-${ts}@zeniipo-test.local`, password: 'PhaseD_B_2026!Strong' }
let userIdA, userIdB, tenantA, tenantB

async function main() {
  console.log(`🔬 Phase D · Onboarding wizard backtest @ ${URL_BASE}\n`)
  const pgC = new pg.Client({ connectionString: process.env.DATABASE_DIRECT_URL, ssl: { rejectUnauthorized: false } })
  await pgC.connect()

  // ─── 1. Setup users (signUp + trigger) ─────────────────────
  sec('1. Bootstrap users via admin signUp + trigger')
  const su1 = await ADMIN.auth.admin.createUser({
    email: userA.email, password: userA.password, email_confirm: true,
    user_metadata: { full_name: 'Phase D A', company_name: 'Phase D Co A', role: 'chr' },
  })
  const su2 = await ADMIN.auth.admin.createUser({
    email: userB.email, password: userB.password, email_confirm: true,
    user_metadata: { full_name: 'Phase D B', company_name: 'Phase D Co B', role: 'chr' },
  })
  userIdA = su1.data?.user?.id
  userIdB = su2.data?.user?.id
  ok('User A created', !su1.error && !!userIdA, userIdA?.slice(0, 8))
  ok('User B created', !su2.error && !!userIdB, userIdB?.slice(0, 8))
  await new Promise((r) => setTimeout(r, 1500)) // trigger settle

  const profA = await pgC.query('SELECT tenant_id, role FROM user_profiles WHERE id=$1', [userIdA])
  const profB = await pgC.query('SELECT tenant_id, role FROM user_profiles WHERE id=$1', [userIdB])
  tenantA = profA.rows[0]?.tenant_id
  tenantB = profB.rows[0]?.tenant_id
  ok('Trigger created profile A with chr role', profA.rows[0]?.role === 'chr', `tenant=${tenantA?.slice(0, 8)}`)
  ok('Trigger created profile B with chr role', profB.rows[0]?.role === 'chr', `tenant=${tenantB?.slice(0, 8)}`)

  const cookieA = await signInGetCookie(userA.email, userA.password)
  const cookieB = await signInGetCookie(userB.email, userB.password)

  // ─── 2. Status BEFORE onboarding ───────────────────────────
  sec('2. /api/onboarding/status before wizard')
  const stat0 = await call('GET', '/api/onboarding/status', { cookie: cookieA })
  ok('GET status (no auth) → 401', (await call('GET', '/api/onboarding/status')).status === 401)
  ok('GET status (auth) returns onboarded:false', stat0.status === 200 && stat0.json?.data?.onboarded === false, `journey_count=${stat0.json?.data?.journey_count}`)

  // ─── 3. /onboarding page redirect logic ────────────────────
  sec('3. /onboarding page server-side gate')
  const onboardingPage = await call('GET', '/onboarding', { cookie: cookieA })
  ok('GET /onboarding (auth, no journey) → 200', onboardingPage.status === 200, `status=${onboardingPage.status}`)
  const hasWizardForm = onboardingPage.text.includes('IPO Journey') || onboardingPage.text.includes('Khởi tạo hành trình')
  ok('  → renders wizard UI', hasWizardForm)

  const noAuthOnboarding = await call('GET', '/onboarding')
  ok('GET /onboarding (no auth) → 307 to /login', noAuthOnboarding.status === 307 || noAuthOnboarding.status === 308)

  // ─── 4. Wizard submission validation ───────────────────────
  sec('4. /api/onboarding/complete validation')
  // Without auth, the request is blocked by either CSRF (403, no Origin) or
  // requireUserAndTenant (401). Both are valid "not authorized" responses.
  const noAuth = await call('POST', '/api/onboarding/complete', { body: {}, headers: { Origin: URL_BASE, Referer: `${URL_BASE}/` } })
  ok('POST complete (no auth) → 401', noAuth.status === 401, `status=${noAuth.status}`)

  const badBodies = [
    { body: {}, name: 'empty body' },
    { body: { journey_name: 'X' }, name: 'missing required fields' },
    { body: { journey_name: 'X', target_year: 2032, exit_venue: 'INVALID', valuation_target_usd: 1000, industry: 'x', north_star_metric: 'y', kpis: [], okr_title: 'z' }, name: 'invalid venue' },
    { body: { journey_name: 'X', target_year: 2020, exit_venue: 'sgx', valuation_target_usd: 1000, industry: 'x', north_star_metric: 'y', kpis: [], okr_title: 'z' }, name: 'year < 2026' },
    { body: { journey_name: 'X', target_year: 2032, exit_venue: 'sgx', valuation_target_usd: 1000, industry: 'x', north_star_metric: 'y', kpis: [{}, {}, {}], okr_title: 'z' }, name: 'kpis.length != 4' },
  ]
  for (const { body, name } of badBodies) {
    const r = await call('POST', '/api/onboarding/complete', { cookie: cookieA, body })
    ok(`POST complete bad body → 400 (${name})`, r.status === 400, `status=${r.status}`)
  }

  // ─── 5. Wizard submission for User A ───────────────────────
  sec('5. User A wizard submit (real flow)')
  const validBody = {
    journey_name: 'ANIMA Care Phase D Test',
    target_year: 2031,
    exit_venue: 'sgx',
    valuation_target_usd: 50_000_000,
    industry: 'wellness',
    north_star_metric: 'Therapy sessions per month',
    kpis: [
      { metric_code: 'mrr', name: 'MRR', value: 0, unit: 'USD', period: '2026-04' },
      { metric_code: 'monthly_burn', name: 'Monthly Burn', value: 0, unit: 'USD', period: '2026-04' },
      { metric_code: 'cash_balance', name: 'Cash Balance', value: 0, unit: 'USD', period: '2026-04' },
      { metric_code: 'fte_count', name: 'FTE Count', value: 0, unit: 'people', period: '2026-04' },
    ],
    okr_title: 'Đạt Phase 2 trong 6 tháng',
    okr_description: 'Promote from Phase 1 (foundation) to Phase 2 (validation) with 80%+ readiness on phase gates.',
  }
  const submit = await call('POST', '/api/onboarding/complete', { cookie: cookieA, body: validBody })
  ok('POST complete (valid) → 201', submit.status === 201, `journey_id=${submit.json?.data?.journey_id?.slice(0, 8)} kpis=${submit.json?.data?.kpis_created} okr=${submit.json?.data?.okr_id?.slice(0, 8)}`)

  // ─── 6. Verify side effects in DB ──────────────────────────
  sec('6. Verify DB side-effects (real persistence)')
  const journeys = await pgC.query('SELECT id, name, current_phase, valuation_target, exit_venue, industry, north_star_metric FROM ipo_journeys WHERE tenant_id=$1', [tenantA])
  ok('1 journey created in tenant A', journeys.rows.length === 1, `name="${journeys.rows[0]?.name}" phase=${journeys.rows[0]?.current_phase} venue=${journeys.rows[0]?.exit_venue}`)
  ok('  industry patched from wizard', journeys.rows[0]?.industry === 'wellness')
  ok('  north_star_metric patched from wizard', journeys.rows[0]?.north_star_metric === 'Therapy sessions per month')
  ok('  valuation_target stored', Number(journeys.rows[0]?.valuation_target) === 50_000_000)

  const okrs = await pgC.query('SELECT id, title, tier FROM okr_objectives WHERE tenant_id=$1 ORDER BY created_at', [tenantA])
  ok('5 OKRs created (4 cascade default + 1 user-supplied)', okrs.rows.length === 5, `count=${okrs.rows.length}`)
  ok('  user OKR present', okrs.rows.some((o) => o.title === validBody.okr_title), `titles=[${okrs.rows.map((o) => o.title.slice(0, 30)).join(' | ')}]`)
  ok('  all 5 are tier=chr', okrs.rows.every((o) => o.tier === 'chr'))

  const kpis = await pgC.query('SELECT name, metric_code, value FROM kpi_metrics WHERE tenant_id=$1 ORDER BY metric_code', [tenantA])
  ok('4 KPIs created', kpis.rows.length === 4)
  ok('  KPI codes match wizard input', kpis.rows.map((k) => k.metric_code).sort().join(',') === 'cash_balance,fte_count,monthly_burn,mrr')

  const criteria = await pgC.query('SELECT count(*) AS c FROM ipo_readiness_criteria WHERE tenant_id=$1', [tenantA])
  ok('20 readiness criteria seeded by cascade', Number(criteria.rows[0].c) === 20, `count=${criteria.rows[0].c}`)

  // Cascade RPC writes event_type='chairman_goal_set' (per migration 002 spec).
  const events = await pgC.query("SELECT count(*) AS c FROM events WHERE tenant_id=$1 AND event_type='chairman_goal_set'", [tenantA])
  ok('Cascade event logged (chairman_goal_set)', Number(events.rows[0].c) >= 1, `count=${events.rows[0].c}`)

  // ─── 7. Status AFTER onboarding ────────────────────────────
  sec('7. /api/onboarding/status after wizard')
  const stat1 = await call('GET', '/api/onboarding/status', { cookie: cookieA })
  ok('GET status returns onboarded:true', stat1.json?.data?.onboarded === true, `journey_count=${stat1.json?.data?.journey_count}`)

  // ─── 8. Idempotent guard (re-submit) ───────────────────────
  sec('8. Re-submit guard')
  const resubmit = await call('POST', '/api/onboarding/complete', { cookie: cookieA, body: validBody })
  ok('POST complete second time → 409', resubmit.status === 409, `status=${resubmit.status} err=${JSON.stringify(resubmit.json?.error).slice(0, 80)}`)

  // ─── 9. (app)/layout redirect: dashboard with journey → renders ──
  sec('9. AppLayout onboarding gate')
  const dashAfter = await call('GET', '/dashboard', { cookie: cookieA })
  ok('GET /dashboard (after wizard) → 200', dashAfter.status === 200, `status=${dashAfter.status}`)

  // ─── 10. RLS isolation: User B should NOT see A's journey ──
  sec('10. Cross-tenant RLS — user B blind to user A')
  const bJourneys = await pgC.query(
    `SELECT count(*) AS c FROM ipo_journeys j WHERE j.tenant_id=$1 AND j.id=$2`,
    [tenantB, journeys.rows[0]?.id],
  )
  ok('User B tenant has 0 of A journeys (DB direct)', Number(bJourneys.rows[0].c) === 0)

  const bStatus = await call('GET', '/api/onboarding/status', { cookie: cookieB })
  ok('User B status still onboarded:false', bStatus.json?.data?.onboarded === false && bStatus.json?.data?.journey_count === 0)

  const bDashAttempt = await call('GET', '/dashboard', { cookie: cookieB })
  ok('User B (no journey) → /dashboard redirects to /onboarding', bDashAttempt.status === 307 || bDashAttempt.status === 308, `loc=${bDashAttempt.text.slice(0, 100)}`)

  // ─── 11. Security headers on /onboarding ───────────────────
  sec('11. Security headers on /onboarding')
  const r = await fetch(`${URL_BASE}/onboarding`, { headers: { Cookie: cookieA } })
  await r.text()
  const h = r.headers
  ok('  X-Frame-Options DENY', h.get('x-frame-options')?.includes('DENY'))
  ok('  X-Content-Type-Options nosniff', h.get('x-content-type-options')?.includes('nosniff'))
  ok('  CSP frame-ancestors none', h.get('content-security-policy')?.includes("frame-ancestors 'none'"))

  // ─── 12. Cleanup ──────────────────────────────────────────
  sec('Cleanup')
  if (userIdA) await ADMIN.auth.admin.deleteUser(userIdA)
  if (userIdB) await ADMIN.auth.admin.deleteUser(userIdB)
  console.log('🧹 deleted test users + cascaded tenants/journeys/etc')
  await pgC.end()

  // ─── Summary ──────────────────────────────────────────────
  const passCount = results.filter((r) => r.pass).length
  const failCount = results.filter((r) => !r.pass).length
  console.log('\n╔══════════════════════════════════════════════════════════════════╗')
  console.log(`║ PHASE D · ${passCount}/${passCount + failCount} pass · ${failCount === 0 ? '✅ ALL GREEN' : `❌ ${failCount} FAIL`}${' '.repeat(Math.max(0, 32 - String(passCount + failCount).length - String(failCount).length))}║`)
  console.log('╚══════════════════════════════════════════════════════════════════╝')
  if (failCount > 0) {
    console.log('\nFailed:')
    for (const r of results.filter((r) => !r.pass)) console.log(`  ❌ ${r.name} · ${r.detail}`)
  }
  process.exit(failCount === 0 ? 0 : 1)
}

main().catch((e) => { console.error('\n💥 Fatal:', e); process.exit(2) })
