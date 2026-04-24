#!/usr/bin/env node
/**
 * Zeniipo IPO data flow comprehensive backtest.
 * Verifies 6 IPO flows + data entry forms + security on PROD.
 */
import { createClient } from '@supabase/supabase-js'
import pg from 'pg'
import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const ROOT = path.resolve(path.dirname(__filename), '..')
dotenv.config({ path: path.join(ROOT, '.env.local') })

const URL = process.argv.find((a) => a.startsWith('--url='))?.slice(6) || 'https://zeniipo.com'
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SB_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const DB = process.env.DATABASE_DIRECT_URL

const admin = createClient(SB_URL, SB_SERVICE)
const ts = Date.now()
const TEST_EMAIL_A = `ipo-a-${ts}@zeniipo-test.local`
const TEST_EMAIL_B = `ipo-b-${ts}@zeniipo-test.local`
const PASS = `IpoTest@${ts}!Strong#`
const results = []
let userA, userB

const ok = (n, c, d = '') => {
  results.push({ n, ok: c, d })
  console.log(`${c ? '✅' : '❌'} ${n}${d ? ' · ' + d : ''}`)
}

const sec = (t) => console.log(`\n━━━ ${t} ━━━`)

async function main() {
  console.log(`🔍 IPO data-flow backtest @ ${URL}`)
  console.log(`📧 Test users: ${TEST_EMAIL_A}, ${TEST_EMAIL_B}\n`)

  // ─── Direct DB readouts ────────────────────────────────────
  sec('DB readouts (admin role)')
  const pgc = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } })
  let dbReachable = false
  try {
    await pgc.connect()
    dbReachable = true
  } catch (e) {
    ok('DB direct reachable', false, e.message.substring(0, 100))
  }

  if (dbReachable) {
    const tables = await pgc.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`,
    )
    ok('Public tables count ≥ 30', tables.rows.length >= 30, `${tables.rows.length} tables`)

    const rpcs = await pgc.query(
      `SELECT proname FROM pg_proc WHERE pronamespace='public'::regnamespace AND prokind='f' AND prosecdef=true`,
    )
    ok(
      'SECURITY DEFINER RPC functions present',
      rpcs.rows.length >= 8,
      `${rpcs.rows.length} fns: ${rpcs.rows
        .map((r) => r.proname)
        .slice(0, 6)
        .join(', ')}...`,
    )

    const policies = await pgc.query(
      `SELECT count(*) AS c FROM pg_policies WHERE schemaname='public'`,
    )
    ok('RLS policies ≥ 50', policies.rows[0].c >= 50, `${policies.rows[0].c} policies`)

    const noRls = await pgc.query(
      `SELECT count(*) AS c FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid
       WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity=false`,
    )
    ok('All public tables RLS-enabled', noRls.rows[0].c === 0, `${noRls.rows[0].c} without RLS`)

    const tenants = await pgc.query(
      `SELECT slug, name FROM tenants WHERE slug IN ('anima','zeni','biotea','wellkoc','zenidigital','zenichain','bthome','nexbuild') ORDER BY slug`,
    )
    ok('8 Zeni ecosystem tenants seeded', tenants.rows.length === 8, tenants.rows.map((r) => r.slug).join(', '))

    const modules = await pgc.query(`SELECT count(*) AS c FROM modules_catalog`)
    ok('32 modules catalog seeded', modules.rows[0].c === 32, `${modules.rows[0].c} rows`)

    const agents = await pgc.query(`SELECT count(*) AS c FROM agent_catalog`)
    ok('108 AI agents catalog', agents.rows[0].c === 108, `${agents.rows[0].c} rows`)

    const phaseContent = await pgc.query(`SELECT count(*) AS c, count(DISTINCT phase_num) AS p FROM phase_content`)
    ok(
      'Phase content covers 10 phases',
      phaseContent.rows[0].p === 10,
      `${phaseContent.rows[0].c} sections × ${phaseContent.rows[0].p} phases`,
    )

    const criteriaTpl = await pgc.query(`SELECT count(*) AS c FROM ipo_readiness_criteria_template`)
    ok('20 IPO readiness criteria template', criteriaTpl.rows[0].c === 20, `${criteriaTpl.rows[0].c}`)

    const tiers = await pgc.query(`SELECT count(*) AS c FROM membership_tiers`)
    ok('5 membership tiers seeded', tiers.rows[0].c === 5, `${tiers.rows[0].c}`)

    const drills = await pgc.query(`SELECT count(*) AS c FROM training_drills`)
    ok(
      'Training drills (≥16 base · 128 = 16×8 ideal)',
      drills.rows[0].c >= 16,
      `${drills.rows[0].c} drills (target ≥16)`,
    )
  }

  // ─── Production endpoints ──────────────────────────────────
  sec('Production HTTP endpoints')
  const fetchHead = async (path) => {
    try {
      const r = await fetch(`${URL}${path}`, { method: 'HEAD' })
      return r.status
    } catch (e) {
      return 0
    }
  }
  ok('GET / → 200', (await fetchHead('/')) === 200)
  ok('GET /login → 200', (await fetchHead('/login')) === 200)
  ok('GET /signup → 200', (await fetchHead('/signup')) === 200)
  ok('GET /api/health → 200', (await fetchHead('/api/health')) === 200)
  ok('GET /api/modules (public) → 200', (await fetchHead('/api/modules')) === 200)
  ok('GET /api/glossary (public) → 200', (await fetchHead('/api/glossary')) === 200)
  ok('GET /dashboard (no auth) → 307 redirect', (await fetchHead('/dashboard')) === 307)
  ok('GET /api/dashboard (no auth) → 401', (await fetchHead('/api/dashboard')) === 401)

  // ─── Security headers on prod ──────────────────────────────
  sec('Security headers on https://zeniipo.com')
  const hr = await fetch(`${URL}/`)
  const h = hr.headers
  const checkHdr = (k, expected) => {
    const v = h.get(k)
    return v && (Array.isArray(expected) ? expected.some((e) => v.includes(e)) : v.includes(expected))
  }
  ok('Strict-Transport-Security max-age 2y + preload', checkHdr('strict-transport-security', 'max-age=63072000') && h.get('strict-transport-security').includes('preload'))
  ok('CSP includes zeniipo.com + supabase + stripe', checkHdr('content-security-policy', ['zeniipo.com', '*.supabase.co', 'js.stripe.com']))
  ok('CSP frame-ancestors none', checkHdr('content-security-policy', "frame-ancestors 'none'"))
  ok('X-Frame-Options DENY', checkHdr('x-frame-options', 'DENY'))
  ok('X-Content-Type-Options nosniff', checkHdr('x-content-type-options', 'nosniff'))
  ok('Referrer-Policy strict-origin-when-cross-origin', checkHdr('referrer-policy', 'strict-origin'))
  ok('Permissions-Policy locks down camera/mic/geo', checkHdr('permissions-policy', ['camera=()', 'microphone=()', 'geolocation=()']))
  ok('Cross-Origin-Opener-Policy same-origin', checkHdr('cross-origin-opener-policy', 'same-origin'))
  ok('Cross-Origin-Resource-Policy same-site', checkHdr('cross-origin-resource-policy', 'same-site'))
  ok('X-Permitted-Cross-Domain-Policies none', checkHdr('x-permitted-cross-domain-policies', 'none'))

  // ─── Signup flow + auto-confirm ────────────────────────────
  sec('Signup flow (real user, real DB)')
  const cu = await admin.auth.admin.createUser({
    email: TEST_EMAIL_A,
    password: PASS,
    email_confirm: true,
    user_metadata: { full_name: 'IPO Test A', company_name: 'IPO Co A', role: 'chr' },
  })
  if (cu.error) {
    ok('Create user A', false, cu.error.message)
  } else {
    userA = cu.data.user.id
    ok('Create user A', true, `id ${userA}`)
  }
  await new Promise((r) => setTimeout(r, 1500))

  let tenantA
  if (dbReachable && userA) {
    const r = await pgc.query(
      `SELECT p.id, p.tenant_id, p.role, t.name FROM user_profiles p JOIN tenants t ON t.id = p.tenant_id WHERE p.id=$1`,
      [userA],
    )
    if (r.rows.length === 1) {
      tenantA = r.rows[0].tenant_id
      ok('Trigger auto-created profile + tenant', true, `tenant=${r.rows[0].name} role=${r.rows[0].role}`)
    } else {
      ok('Trigger auto-created profile + tenant', false, 'profile missing')
    }
  }

  // ─── IPO Flow 1 · Cascade event creates journey + 4 CHR objectives ──
  sec('IPO Flow 1 · Chairman Cascade Engine')
  const userClient = createClient(SB_URL, SB_ANON)
  await userClient.auth.signInWithPassword({ email: TEST_EMAIL_A, password: PASS })

  if (tenantA) {
    const cas = await userClient.rpc('cascade_chairman_event', {
      p_tenant_id: tenantA,
      p_valuation: 3130000000,
      p_venue: 'sgx',
      p_year: 2031,
      p_industry: 'biotech',
      p_strategy: 'IPO test cascade',
    })
    ok('cascade_chairman_event RPC succeeds', !cas.error, cas.error?.message || `journey=${cas.data?.journey_id?.substring(0, 8)}`)

    const objCount = await userClient.from('okr_objectives').select('id', { count: 'exact', head: true }).eq('tier', 'chr')
    ok('4 CHR objectives created', objCount.count === 4, `count=${objCount.count}`)

    const journeyRes = await userClient.from('ipo_journeys').select('current_phase, valuation_target').single()
    ok(
      'Journey row exists with phase=1 + valuation 3.13B',
      !journeyRes.error && journeyRes.data?.current_phase === 1 && Number(journeyRes.data?.valuation_target) === 3130000000,
      JSON.stringify(journeyRes.data),
    )
  }

  // ─── IPO Flow 2 · Phase gate seed (auto-trigger on journey created) ─
  sec('IPO Flow 2 · IPO Readiness 20-criteria seed on journey')
  if (dbReachable && tenantA) {
    const cri = await pgc.query(
      `SELECT count(*) AS c FROM ipo_readiness_criteria WHERE tenant_id=$1`,
      [tenantA],
    )
    ok('20 readiness criteria seeded for new journey', cri.rows[0].c === 20, `${cri.rows[0].c} rows`)

    const score = await userClient.rpc('compute_readiness_score', {
      p_journey_id: (await userClient.from('ipo_journeys').select('id').single()).data.id,
    })
    ok('compute_readiness_score RPC works', !score.error, JSON.stringify(score.data).substring(0, 150))
  }

  // ─── IPO Flow 3 · Fundraise round insert + cap table snapshot trigger ─
  sec('IPO Flow 3 · Fundraise pipeline → Cap table sync')
  if (tenantA) {
    const journey = (await userClient.from('ipo_journeys').select('id').single()).data
    const round = await userClient
      .from('fundraise_rounds')
      .insert({
        tenant_id: tenantA,
        journey_id: journey.id,
        round_code: 'seed',
        round_name: 'Seed Q3/2026',
        target_raise_usd: 500000,
        pre_money_usd: 4500000,
        post_money_usd: 5000000,
        status: 'planning',
      })
      .select()
      .single()
    ok('Insert fundraise_rounds (planning)', !round.error, round.error?.message || `round_id=${round.data?.id?.substring(0, 8)}`)

    if (round.data) {
      const investor = await userClient
        .from('investor_pipeline')
        .insert({
          tenant_id: tenantA,
          round_id: round.data.id,
          investor_name: 'Demo VC Capital',
          investor_type: 'vc',
          stage: 'outreach',
          target_check_usd: 250000,
          probability_pct: 30,
        })
        .select()
        .single()
      ok('Insert investor_pipeline', !investor.error, investor.error?.message || investor.data?.id?.substring(0, 8))

      // Move round to closed → trigger fires event
      const closed = await userClient
        .from('fundraise_rounds')
        .update({ status: 'closed', actual_raise_usd: 500000, actual_close_date: new Date().toISOString().slice(0, 10) })
        .eq('id', round.data.id)
        .select()
        .single()
      ok('Round status → closed', !closed.error, closed.error?.message || `status=${closed.data?.status}`)

      await new Promise((r) => setTimeout(r, 800))
      const events = await userClient.from('events').select('event_type').eq('event_type', 'round_closed').limit(1)
      ok('Trigger fired event_type=round_closed', !events.error && events.data?.length >= 1, `${events.data?.length} events`)
    }
  }

  // ─── IPO Flow 4 · DD investor access + audit log ───────────────────
  sec('IPO Flow 4 · DD Access + Audit Trail')
  if (tenantA) {
    const round = (await userClient.from('fundraise_rounds').select('id').single()).data
    if (round) {
      const dd = await userClient
        .from('dd_investor_access')
        .insert({
          tenant_id: tenantA,
          round_id: round.id,
          invitee_email: 'investor@demo-vc.com',
          invitee_name: 'Demo VC',
          can_download: false,
          watermark_pattern: 'investor@demo-vc.com',
        })
        .select()
        .single()
      ok('DD investor access invite created', !dd.error, dd.error?.message || `token len ${dd.data?.access_token?.length}`)
    }
  }

  // ─── IPO Flow 5 · OKR + Tasks (data entry) ─────────────────────────
  sec('IPO Flow 5 · OKR + Task data entry')
  if (tenantA) {
    const obj = (await userClient.from('okr_objectives').select('id').eq('tier', 'chr').limit(1).single()).data
    if (obj) {
      const kr = await userClient
        .from('okr_krs')
        .insert({
          objective_id: obj.id,
          title: 'Đạt MRR $50K/tháng',
          metric_type: 'number',
          target_value: 50000,
          actual_value: 28500,
          unit: 'USD',
        })
        .select()
        .single()
      ok('Insert KR (KR linked to chr objective)', !kr.error, kr.error?.message)

      if (kr.data) {
        const task = await userClient
          .from('tasks')
          .insert({
            tenant_id: tenantA,
            kr_id: kr.data.id,
            title: 'Khoá Big4 audit Q4/2026',
            priority: 't1',
            status: 'todo',
          })
          .select()
          .single()
        ok('Insert task linked to KR', !task.error, task.error?.message || task.data?.id?.substring(0, 8))
      }
    }
  }

  // ─── IPO Flow 6 · Academy progress (membership gate) ───────────────
  sec('IPO Flow 6 · Academy membership gate')
  if (tenantA) {
    const phaseRow = (await userClient.from('phase_content').select('id, phase_num').eq('phase_num', 1).limit(1).single()).data
    if (phaseRow) {
      const access = await userClient.rpc('has_academy_access', {
        p_content_type: 'phase_content',
        p_content_id: phaseRow.id,
      })
      ok('has_academy_access RPC works', !access.error, JSON.stringify(access.data))
    }
  }

  // ─── Security · RLS isolation cross-tenant ─────────────────────────
  sec('Security · RLS isolation (CRITICAL)')
  const cuB = await admin.auth.admin.createUser({
    email: TEST_EMAIL_B,
    password: PASS,
    email_confirm: true,
    user_metadata: { full_name: 'IPO Test B', company_name: 'IPO Co B', role: 'chr' },
  })
  if (!cuB.error) {
    userB = cuB.data.user.id
    await new Promise((r) => setTimeout(r, 1500))
    const userBClient = createClient(SB_URL, SB_ANON)
    await userBClient.auth.signInWithPassword({ email: TEST_EMAIL_B, password: PASS })

    const userBJourneys = await userBClient.from('ipo_journeys').select('*')
    ok(
      'User B sees 0 journeys (RLS scoped to own tenant)',
      !userBJourneys.error && userBJourneys.data?.length === 0,
      `data length=${userBJourneys.data?.length}`,
    )

    const userBProfiles = await userBClient.from('user_profiles').select('*')
    ok(
      'User B sees only own profile (RLS isolation)',
      !userBProfiles.error && userBProfiles.data?.length === 1,
      `count=${userBProfiles.data?.length}`,
    )

    const userBOkrs = await userBClient.from('okr_objectives').select('*')
    ok(
      'User B sees 0 OKRs from User A tenant',
      !userBOkrs.error && userBOkrs.data?.length === 0,
      `count=${userBOkrs.data?.length}`,
    )
  }

  // ─── Security · Auth policies ──────────────────────────────────────
  sec('Security · Auth + rate-limit')
  const weakPwd = await admin.auth.admin.createUser({
    email: `weak-${ts}@test.local`,
    password: 'short',
    email_confirm: true,
  })
  ok('Weak password rejected (≥12 chars policy)', !!weakPwd.error, weakPwd.error?.message?.substring(0, 80) || 'unexpectedly accepted')

  // CSRF — POST without origin
  const csrfRes = await fetch(`${URL}/api/journeys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', origin: 'https://evil.com' },
    body: JSON.stringify({ name: 'hack' }),
  })
  ok(
    'CSRF cross-origin POST rejected',
    csrfRes.status === 403 || csrfRes.status === 401,
    `status=${csrfRes.status}`,
  )

  // ─── Cleanup ──────────────────────────────────────────────────────
  sec('Cleanup')
  if (userA) await admin.auth.admin.deleteUser(userA)
  if (userB) await admin.auth.admin.deleteUser(userB)
  console.log('🧹 Test users deleted')
  if (dbReachable) await pgc.end()

  // ─── Summary ──────────────────────────────────────────────────────
  const passed = results.filter((r) => r.ok).length
  const total = results.length
  const grade = passed === total ? '10/10' : `${passed}/${total}`
  console.log(`\n╔${'═'.repeat(64)}╗`)
  console.log(`║ IPO DATA-FLOW BACKTEST · ${grade.padEnd(8)} · ${(passed === total ? '✅ PASS' : '⚠️  PARTIAL').padEnd(13)}                 ║`)
  console.log(`║ URL: ${URL.padEnd(57)}║`)
  console.log(`╚${'═'.repeat(64)}╝`)
  if (passed !== total) {
    console.log('\nFailed:')
    results.filter((r) => !r.ok).forEach((r) => console.log(`  ❌ ${r.n} · ${r.d}`))
  }
}

main().catch(async (err) => {
  console.error('💥 Fatal:', err)
  if (userA) admin.auth.admin.deleteUser(userA).catch(() => {})
  if (userB) admin.auth.admin.deleteUser(userB).catch(() => {})
  process.exit(1)
})
