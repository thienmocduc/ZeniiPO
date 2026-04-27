#!/usr/bin/env node
/**
 * Phase A — Database & RPC backtest.
 * 10 verification groups against the live prod DB (zeniipo-prod · Singapore).
 * Read-only except for trigger + RLS isolation tests which create + clean
 * up disposable test users in their own tenants.
 */
import { createClient } from '@supabase/supabase-js'
import pg from 'pg'
import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const ROOT = path.resolve(path.dirname(__filename), '..')
dotenv.config({ path: path.join(ROOT, '.env.local') })

const SB = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const ADMIN = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const results = []
const ok = (n, c, d = '') => {
  results.push({ name: n, pass: c, detail: d })
  console.log(`${c ? '✅' : '❌'} ${n}${d ? ' · ' + d : ''}`)
}
const sec = (t) => console.log(`\n━━━ ${t} ━━━`)

const pgClient = new pg.Client({ connectionString: process.env.DATABASE_DIRECT_URL, ssl: { rejectUnauthorized: false } })
await pgClient.connect()
const q = (sql, params) => pgClient.query(sql, params)

async function main() {
  console.log('🔬 Phase A · Database & RPC backtest @ ' + process.env.NEXT_PUBLIC_SUPABASE_URL)

  // ─── 1. Tables count + RLS coverage ────────────────────────
  sec('1. Schema state')
  const tables = await q(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`)
  ok('Public tables ≥ 41', tables.rows.length >= 41, `${tables.rows.length} tables`)

  const noRls = await q(`SELECT count(*) AS c FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity=false`)
  ok('All public tables RLS-enabled', noRls.rows[0].c == 0, `${noRls.rows[0].c} without RLS`)

  const policies = await q(`SELECT count(*) AS c FROM pg_policies WHERE schemaname='public'`)
  ok('RLS policies ≥ 72', policies.rows[0].c >= 72, `${policies.rows[0].c} policies`)

  // ─── 2. SECURITY DEFINER RPCs ──────────────────────────────
  sec('2. SECURITY DEFINER RPCs')
  const REQUIRED_SECDEF = [
    'current_tenant_id', 'handle_new_user', 'has_role', 'is_chairman_super',
    'is_chr_or_ceo', 'list_accessible_tenants', 'seed_readiness_criteria_for_journey',
    'compute_readiness_score',
  ]
  const secdef = await q(`SELECT proname FROM pg_proc WHERE pronamespace='public'::regnamespace AND prokind='f' AND prosecdef=true`)
  const have = new Set(secdef.rows.map((r) => r.proname))
  for (const fn of REQUIRED_SECDEF) {
    ok(`SECDEF · ${fn}`, have.has(fn), have.has(fn) ? 'present' : 'MISSING')
  }
  ok('Total SECDEF count ≥ 8', secdef.rows.length >= 8, `${secdef.rows.length} fns`)

  // ─── 3. Migration 010 — 6 new tables ───────────────────────
  sec('3. Migration 010 · 6 new tables')
  const NEW_TABLES = ['comparables', 'market_data', 'market_intel', 'feedback_items', 'tokenomics_allocations', 'nlq_logs']
  for (const t of NEW_TABLES) {
    const r = await q(`SELECT count(*) AS c FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`, [t])
    ok(`Table · ${t}`, r.rows[0].c == 1)
    const pol = await q(`SELECT count(*) AS c FROM pg_policies WHERE schemaname='public' AND tablename=$1`, [t])
    ok(`  RLS policies on ${t} ≥ 2`, pol.rows[0].c >= 2, `${pol.rows[0].c} policies`)
  }

  // ─── 4. Migration 011 — subscriptions extra cols ───────────
  sec('4. Migration 011 · subscriptions extra cols')
  const subCols = await q(`SELECT column_name FROM information_schema.columns WHERE table_name='subscriptions' AND table_schema='public'`)
  const subColSet = new Set(subCols.rows.map((r) => r.column_name))
  for (const c of ['price_id', 'canceled_at', 'tier_code']) {
    ok(`subscriptions.${c}`, subColSet.has(c))
  }
  const subFK = await q(`SELECT count(*) AS c FROM information_schema.table_constraints WHERE table_schema='public' AND table_name='subscriptions' AND constraint_type='FOREIGN KEY'`)
  ok('subscriptions FK count ≥ 2', subFK.rows[0].c >= 2, `${subFK.rows[0].c} FK`)
  const subIdx = await q(`SELECT count(*) AS c FROM pg_indexes WHERE schemaname='public' AND tablename='subscriptions'`)
  ok('subscriptions indexes ≥ 4', subIdx.rows[0].c >= 4, `${subIdx.rows[0].c} indexes`)

  // ─── 5. Trigger handle_new_user ────────────────────────────
  sec('5. Trigger handle_new_user')
  const trgSrc = await q(`SELECT prosecdef, pg_get_function_result(oid) AS ret FROM pg_proc WHERE proname='handle_new_user'`)
  ok('handle_new_user is SECDEF + returns trigger', trgSrc.rows[0]?.prosecdef === true && trgSrc.rows[0]?.ret === 'trigger')
  const trg = await q(`SELECT tgname FROM pg_trigger WHERE tgname='on_auth_user_created'`)
  ok('on_auth_user_created trigger exists', trg.rows.length === 1)

  // ─── 6. cascade_chairman_event RPC signature ───────────────
  sec('6. cascade_chairman_event RPC signature')
  const cascSig = await q(`SELECT pg_get_function_arguments(oid) AS args FROM pg_proc WHERE proname='cascade_chairman_event'`)
  const args = cascSig.rows[0]?.args ?? ''
  const REQ_PARAMS = ['p_tenant_id', 'p_valuation', 'p_venue', 'p_year', 'p_industry', 'p_strategy']
  for (const p of REQ_PARAMS) {
    ok(`  param · ${p}`, args.includes(p))
  }

  // ─── 7. Live trigger + cascade test (creates throwaway user) ───
  sec('7. Live trigger + cascade test')
  const ts = Date.now()
  const email = `phaseA-${ts}@zeniipo-test.local`
  const { data: signup, error: e0 } = await SB.auth.signUp({
    email,
    password: 'PhaseAStrong2026!Test',
    options: { data: { full_name: 'Phase A Test', company_name: 'Phase A Co', role: 'chr' } },
  })
  ok('  signUp succeeds', !e0 && !!signup.user, e0?.message ?? `id ${signup?.user?.id?.substring(0, 8)}`)
  const userId = signup?.user?.id

  if (userId) {
    // Trigger should auto-create tenant + user_profile.
    const profile = await q(`SELECT id, tenant_id, role, email FROM user_profiles WHERE id=$1`, [userId])
    ok('  trigger created user_profile', profile.rows.length === 1, profile.rows[0] ? `tenant=${profile.rows[0].tenant_id?.substring(0, 8)}` : 'missing')
    const tenantId = profile.rows[0]?.tenant_id

    const tenant = await q(`SELECT slug, name FROM tenants WHERE id=$1`, [tenantId])
    ok('  trigger created tenant', tenant.rows.length === 1, tenant.rows[0]?.slug)

    // cascade_chairman_event should create journey + 4 CHR objectives + 20 readiness criteria.
    const cas = await SB.rpc('cascade_chairman_event', {
      p_tenant_id: tenantId,
      p_valuation: 1_000_000_000,
      p_venue: 'sgx',
      p_year: 2031,
      p_industry: 'wellness',
      p_strategy: 'Phase A test cascade — auto cleanup',
    })
    ok('  cascade RPC returns success', !cas.error && cas.data?.status === 'success', cas.error?.message ?? `journey=${cas.data?.journey_id?.substring(0, 8)}`)

    if (cas.data?.journey_id) {
      const okrs = await q(`SELECT count(*) AS c FROM okr_objectives WHERE tenant_id=$1 AND tier='chr'`, [tenantId])
      ok('  4 CHR objectives created', okrs.rows[0].c == 4, `${okrs.rows[0].c} OKRs`)
      const cri = await q(`SELECT count(*) AS c FROM ipo_readiness_criteria WHERE journey_id=$1`, [cas.data.journey_id])
      ok('  20 readiness criteria seeded', cri.rows[0].c == 20, `${cri.rows[0].c} criteria`)

      // compute_readiness_score must succeed for the user (was the bug fixed in migration 009).
      const score = await SB.rpc('compute_readiness_score', { p_journey_id: cas.data.journey_id })
      ok('  compute_readiness_score returns jsonb', !score.error && score.data != null, score.error?.message ?? `total=${score.data?.total_score}`)
    }

    // ─── 8. RLS isolation — second user must not see first tenant ───
    sec('8. RLS isolation')
    const email2 = `phaseB-${ts}@zeniipo-test.local`
    const { data: s2 } = await SB.auth.signUp({ email: email2, password: 'PhaseBStrong2026!Test' })
    if (s2?.user) {
      const userClientB = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
      await userClientB.auth.signInWithPassword({ email: email2, password: 'PhaseBStrong2026!Test' })
      const j = await userClientB.from('ipo_journeys').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)
      ok('  user B sees 0 journeys of user A tenant', (j.count ?? 0) === 0, `count=${j.count}`)
      const o = await userClientB.from('okr_objectives').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)
      ok('  user B sees 0 OKRs of user A tenant', (o.count ?? 0) === 0, `count=${o.count}`)
      // cleanup
      await ADMIN.auth.admin.deleteUser(s2.user.id)
    }

    // cleanup
    await ADMIN.auth.admin.deleteUser(userId)
    console.log('🧹 cleaned up test users')
  }

  // ─── 9. Helper RPC behaviour ───────────────────────────────
  sec('9. Helper RPC behaviour')
  const acc = await ADMIN.rpc('list_accessible_tenants')
  ok('list_accessible_tenants callable', !acc.error, acc.error?.message ?? 'no error')
  const cur = await ADMIN.rpc('current_tenant_id')
  ok('current_tenant_id callable', !cur.error, cur.error?.message ?? 'no error')

  // ─── 10. Phase 1 readiness criteria template ───────────────
  sec('10. Phase 1 content + readiness template')
  const tpl = await q(`SELECT count(*) AS c FROM ipo_readiness_criteria_template`)
  ok('Template = 20 criteria', tpl.rows[0].c == 20, `${tpl.rows[0].c}`)
  const phase1 = await q(`SELECT count(*) AS c FROM phase_content WHERE phase_num=1`)
  ok('Phase 1 sections seeded', phase1.rows[0].c >= 4, `${phase1.rows[0].c} sections`)
  const animaJourney = await q(`
    SELECT j.id, j.industry, j.north_star_metric, j.current_phase, t.slug
    FROM ipo_journeys j JOIN tenants t ON t.id=j.tenant_id WHERE t.slug='anima'`)
  ok('Anima Care has live IPO journey', animaJourney.rows.length === 1, animaJourney.rows[0] ? `industry=${animaJourney.rows[0].industry}, NSM=${animaJourney.rows[0].north_star_metric}` : 'NO journey')

  // ─── Summary ───────────────────────────────────────────────
  const passCount = results.filter((r) => r.pass).length
  const failCount = results.filter((r) => !r.pass).length
  console.log('\n╔══════════════════════════════════════════════════════════════════╗')
  console.log(`║ PHASE A · ${passCount}/${passCount + failCount} pass · ${failCount === 0 ? '✅ ALL GREEN' : `❌ ${failCount} FAIL`}${' '.repeat(Math.max(0, 30 - String(passCount + failCount).length))}║`)
  console.log('╚══════════════════════════════════════════════════════════════════╝')
  if (failCount > 0) {
    console.log('\nFailed:')
    for (const r of results.filter((r) => !r.pass)) console.log(`  ❌ ${r.name} · ${r.detail}`)
  }
  await pgClient.end()
  process.exit(failCount === 0 ? 0 : 1)
}

main().catch(async (e) => {
  console.error('\n💥 Fatal:', e)
  await pgClient.end().catch(() => {})
  process.exit(2)
})
