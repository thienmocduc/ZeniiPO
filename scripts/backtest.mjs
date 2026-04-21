#!/usr/bin/env node
/**
 * Zeniipo CTO Backtest
 * End-to-end verification on real production URL with real Supabase account.
 *
 * Steps:
 *   1. Create test user via Supabase Admin API (auto-confirmed — skips email verification)
 *   2. Login via web API (POST /api/... or Supabase client) to get session cookies
 *   3. Hit dashboard, journeys, cascade, council endpoints
 *   4. Verify DB state matches: journey created, OKR cascade happened
 *   5. Cleanup: delete test user
 *
 * Usage: node scripts/backtest.mjs [--url https://zeniipo.vercel.app]
 */
import { createClient } from '@supabase/supabase-js'
import pg from 'pg'
import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')
dotenv.config({ path: path.join(ROOT, '.env.local') })

const BASE_URL = process.argv.find((a) => a.startsWith('--url='))?.slice(6) || 'https://zeniipo.vercel.app'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const DB_URL = process.env.DATABASE_DIRECT_URL

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !SUPABASE_ANON_KEY || !DB_URL) {
  console.error('❌ Missing env vars')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
const ts = Date.now()
const TEST_EMAIL = `backtest-${ts}@zeniipo-test.local`
const TEST_PASSWORD = `Backtest@${ts}!`
const TEST_COMPANY = `Backtest Co ${ts}`

let userId = null
let session = null
const results = []

function check(name, ok, detail = '') {
  const mark = ok ? '✅' : '❌'
  console.log(`${mark} ${name}${detail ? ' · ' + detail : ''}`)
  results.push({ name, ok, detail })
}

async function wait(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  console.log(`🔍 CTO Backtest @ ${BASE_URL}`)
  console.log(`📧 Test user: ${TEST_EMAIL}\n`)

  // ─── Gate 1: Public endpoints ──────────────────────────────────
  console.log('━━━ Gate 1 · Public endpoints ━━━')
  const healthRes = await fetch(`${BASE_URL}/api/health`)
  const healthBody = await healthRes.json()
  check('GET /api/health', healthRes.status === 200 && healthBody.status === 'ok', `status=${healthRes.status}`)

  const modulesRes = await fetch(`${BASE_URL}/api/modules`)
  const modulesBody = await modulesRes.json()
  check(
    'GET /api/modules',
    modulesRes.status === 200 && Array.isArray(modulesBody.data) && modulesBody.data.length === 32,
    `rows=${modulesBody.data?.length}`,
  )

  const glossaryRes = await fetch(`${BASE_URL}/api/glossary`)
  const glossaryBody = await glossaryRes.json()
  check(
    'GET /api/glossary',
    glossaryRes.status === 200 && Array.isArray(glossaryBody.data) && glossaryBody.data.length >= 20,
    `rows=${glossaryBody.data?.length}`,
  )

  const landingRes = await fetch(`${BASE_URL}/`)
  check('GET / (landing)', landingRes.status === 200, `bytes=${(await landingRes.text()).length}`)

  // ─── Gate 2: Protected routes reject unauthenticated ───────────
  console.log('\n━━━ Gate 2 · Protected routes ━━━')
  const dashApi = await fetch(`${BASE_URL}/api/dashboard`)
  check('GET /api/dashboard (no auth) → 401', dashApi.status === 401, `status=${dashApi.status}`)

  const journeysApi = await fetch(`${BASE_URL}/api/journeys`)
  check('GET /api/journeys (no auth) → 401', journeysApi.status === 401, `status=${journeysApi.status}`)

  const dashPage = await fetch(`${BASE_URL}/dashboard`, { redirect: 'manual' })
  check('GET /dashboard (no auth) → 307 redirect', dashPage.status === 307 || dashPage.status === 302, `status=${dashPage.status}`)

  // ─── Gate 3: Signup real user via Admin (skip email confirm) ───
  console.log('\n━━━ Gate 3 · Create + Login real user ━━━')
  const { data: userData, error: userErr } = await admin.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: 'CTO Backtest', company_name: TEST_COMPANY, role: 'chr' },
  })
  if (userErr) {
    check('Create test user', false, userErr.message)
    return
  }
  userId = userData.user.id
  check('Create test user', true, `id=${userId}`)

  // Wait for handle_new_user trigger to create profile + tenant
  await wait(2000)

  const pgClient = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })
  await pgClient.connect()

  const profileRes = await pgClient.query(
    `SELECT p.id, p.tenant_id, p.role, t.name, t.plan FROM user_profiles p JOIN tenants t ON t.id = p.tenant_id WHERE p.id = $1`,
    [userId],
  )
  check(
    'Trigger handle_new_user created profile + tenant',
    profileRes.rows.length === 1 && profileRes.rows[0].tenant_id && profileRes.rows[0].role === 'chr',
    profileRes.rows[0] ? `tenant=${profileRes.rows[0].name} role=${profileRes.rows[0].role}` : 'no row',
  )

  // Login via Supabase client using anon key (same path UI uses)
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const { data: signIn, error: signInErr } = await userClient.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  })
  check('Sign in with password', !signInErr && !!signIn?.session, signInErr?.message || 'got session')
  session = signIn?.session

  // ─── Gate 4: Authenticated requests ────────────────────────────
  console.log('\n━━━ Gate 4 · Authenticated API calls ━━━')
  if (session) {
    const authHeaders = {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    }

    // Use Supabase client directly for DB queries (RLS will kick in)
    userClient.auth.setSession(session)

    const { data: journeysData, error: jErr } = await userClient.from('ipo_journeys').select('*')
    check(
      'SELECT ipo_journeys (RLS scoped to tenant) returns 0',
      !jErr && Array.isArray(journeysData) && journeysData.length === 0,
      jErr?.message || `rows=${journeysData?.length}`,
    )

    // Test RLS isolation: try to read another tenant's data
    const { data: allProfiles } = await userClient.from('user_profiles').select('*')
    check(
      'SELECT user_profiles returns only own profile (RLS isolation)',
      Array.isArray(allProfiles) && allProfiles.length === 1,
      `rows=${allProfiles?.length}`,
    )

    // Call cascade RPC
    const { data: cascadeData, error: cErr } = await userClient.rpc('cascade_chairman_event', {
      p_tenant_id: profileRes.rows[0].tenant_id,
      p_valuation: 3130000000,
      p_venue: 'sgx',
      p_year: 2031,
      p_industry: 'biotech',
      p_strategy: 'Backtest cascade',
    })
    check(
      'RPC cascade_chairman_event succeeds + creates journey',
      !cErr && cascadeData?.status === 'success',
      cErr?.message || JSON.stringify(cascadeData).substring(0, 100),
    )

    // Verify 4 CHR objectives created
    await wait(500)
    const { data: objectives } = await userClient.from('okr_objectives').select('*').eq('tier', 'chr')
    check(
      '4 CHR objectives created by cascade',
      Array.isArray(objectives) && objectives.length === 4,
      `rows=${objectives?.length}`,
    )
  }

  // ─── Gate 5: Security headers ──────────────────────────────────
  console.log('\n━━━ Gate 5 · Security headers on prod ━━━')
  const secRes = await fetch(`${BASE_URL}/`)
  const headers = secRes.headers
  check('X-Frame-Options', headers.get('x-frame-options') === 'DENY')
  check('Strict-Transport-Security present', !!headers.get('strict-transport-security'))
  check('X-Content-Type-Options', headers.get('x-content-type-options') === 'nosniff')
  check('Content-Security-Policy present', !!headers.get('content-security-policy'))
  check('Referrer-Policy', headers.get('referrer-policy') === 'strict-origin-when-cross-origin')

  // ─── Cleanup ──────────────────────────────────────────────────
  console.log('\n━━━ Cleanup ━━━')
  if (userId) {
    await admin.auth.admin.deleteUser(userId)
    console.log(`🧹 Deleted test user ${userId}`)
  }
  await pgClient.end()

  // ─── Summary ──────────────────────────────────────────────────
  const passed = results.filter((r) => r.ok).length
  const total = results.length
  const grade = passed === total ? '10/10' : `${passed}/${total}`
  console.log(`\n╔${'═'.repeat(60)}╗`)
  console.log(`║ CTO BACKTEST · ${grade.padEnd(10)} ${passed === total ? '✅ PASS' : '⚠️  FAIL'}${' '.repeat(30)}║`)
  console.log(`║ URL: ${BASE_URL.padEnd(53)}║`)
  console.log(`╚${'═'.repeat(60)}╝`)

  if (passed !== total) {
    console.log('\nFailed checks:')
    results.filter((r) => !r.ok).forEach((r) => console.log(`  ❌ ${r.name} · ${r.detail}`))
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('💥 Backtest error:', err)
  if (userId) admin.auth.admin.deleteUser(userId).catch(() => {})
  process.exit(1)
})
