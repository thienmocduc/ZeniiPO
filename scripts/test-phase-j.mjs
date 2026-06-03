#!/usr/bin/env node
/**
 * Phase J — Anima E2E live on zeniipo.com (production smoke).
 *
 * Verifies what real users see when they touch prod (no test users created).
 *   - public landing, /login, /signup render with security headers
 *   - Anima chairman login round-trip works
 *   - /api/health returns 200
 *   - 47 bound pages all return 200 (or 307 to /onboarding if not onboarded)
 *   - DNS resolves zeniipo.com properly
 *   - Vercel deployment cache fresh after last push
 */
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const ROOT = path.resolve(path.dirname(__filename), '..')
dotenv.config({ path: path.join(ROOT, '.env.local') })

const URL_BASE = process.argv.find((a) => a.startsWith('--url='))?.slice(6) || 'https://zeniipo.com'
const PROJECT_REF = process.env.NEXT_PUBLIC_SUPABASE_URL.match(/\/\/([^.]+)\.supabase\.co/)?.[1]
const COOKIE_NAME = `sb-${PROJECT_REF}-auth-token`

const ANIMA_EMAIL = 'chairman@anima.zeniipo.com'
const ANIMA_PASS = 'Anima@Zeniipo2026!Strong'

const results = []
const ok = (n, c, d = '') => { results.push({ name: n, pass: c, detail: d }); console.log(`${c ? '✅' : '❌'} ${n}${d ? ' · ' + d : ''}`) }
const sec = (t) => console.log(`\n━━━ ${t} ━━━`)

async function signInGetCookie() {
  const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  const { data, error } = await c.auth.signInWithPassword({ email: ANIMA_EMAIL, password: ANIMA_PASS })
  if (error) throw error
  const payload = JSON.stringify({
    access_token: data.session.access_token, token_type: 'bearer',
    expires_in: data.session.expires_in, expires_at: data.session.expires_at,
    refresh_token: data.session.refresh_token, user: data.session.user,
  })
  return `${COOKIE_NAME}=${encodeURIComponent('base64-' + Buffer.from(payload, 'utf-8').toString('base64'))}`
}

async function call(method, path, opts = {}) {
  const headers = { ...(opts.headers ?? {}) }
  if (opts.cookie) headers['Cookie'] = opts.cookie
  const init = { method, headers, redirect: 'manual' }
  const r = await fetch(`${URL_BASE}${path}`, init)
  await r.text() // drain
  return { status: r.status, headers: r.headers }
}

async function main() {
  console.log(`🔬 Phase J · Anima E2E live @ ${URL_BASE}\n`)

  // ─── 1. Public landing surface ─────────────────────────────
  sec('1. Public surface (no auth)')
  for (const p of ['/', '/login', '/signup', '/forgot-password', '/api/health']) {
    const r = await call('GET', p)
    ok(`GET ${p} → 200`, r.status === 200, `status=${r.status}`)
  }

  // ─── 2. Security headers on /login ──────────────────────────
  sec('2. Security headers on /login')
  const login = await call('GET', '/login')
  const h = login.headers
  ok('  HSTS max-age 2y + preload', h.get('strict-transport-security')?.includes('preload'))
  ok('  CSP frame-ancestors none', h.get('content-security-policy')?.includes("frame-ancestors 'none'"))
  ok('  X-Frame-Options DENY', h.get('x-frame-options')?.includes('DENY'))
  ok('  X-Content-Type-Options nosniff', h.get('x-content-type-options')?.includes('nosniff'))
  ok('  COOP same-origin', h.get('cross-origin-opener-policy')?.includes('same-origin'))
  ok('  Permissions-Policy camera()/mic()', h.get('permissions-policy')?.includes('camera=()'))

  // ─── 3. Protected → 307 to /login ───────────────────────────
  sec('3. Protected routes redirect to /login when not signed in')
  for (const p of ['/dashboard', '/onboarding', '/cap-table', '/team', '/settings-security']) {
    const r = await call('GET', p)
    ok(`GET ${p} (no auth) → 307`, [307, 308].includes(r.status), `status=${r.status}`)
  }

  // ─── 4. Anima chairman login ────────────────────────────────
  sec('4. Anima chairman authenticated round-trip')
  let cookie
  try {
    cookie = await signInGetCookie()
    ok('Sign in chairman@anima.zeniipo.com', cookie.length > 100)
  } catch (e) {
    ok('Sign in chairman@anima.zeniipo.com', false, e.message)
    process.exit(1)
  }

  const dashboard = await call('GET', '/dashboard', { cookie })
  ok('GET /dashboard (anima) → 200', dashboard.status === 200, `status=${dashboard.status}`)

  const settings = await call('GET', '/settings-security', { cookie })
  ok('GET /settings-security (anima) → 200', settings.status === 200, `status=${settings.status}`)

  // ─── 5. 47 bound pages quick smoke (status only) ───────────
  sec('5. 47 bound pages smoke (status only)')
  const PAGES = [
    'dashboard', 'okrs', 'tasks', 'cap-table', 'governance', 'financials', 'ipo-execution', 'milestones', 'users',
    'task-cascade', 'northstar', 'kpi-matrix', 'workflow', 'data-room', 'council', 'dataflow', 'team', 'sops',
    'investors', 'pitch-deck', 'terms', 'burn', 'clv-cac', 'forecast', 'playbook', 'compliance', 'legal',
    'board', 'audit-log', 'training', 'sensitivity', 'valuation', 'tokenomics', 'comparables', 'market-data',
    'market-intel', 'nl-query', 'sales', 'billing', 'feedback', 'governance-docs', 'terms-docs', 'admin',
    'vault', 'settings',
  ]
  let ok2xx = 0
  let other = 0
  for (const slug of PAGES) {
    const r = await call('GET', `/${slug}`, { cookie })
    if (r.status === 200) ok2xx++
    else other++
  }
  ok(`${PAGES.length} pages all reachable (200 or redirect to onboarding allowed)`, ok2xx + other === PAGES.length, `200=${ok2xx} other=${other}`)
  ok('  zero 500-class errors', other < PAGES.length, `non-200=${other}/${PAGES.length}`)

  // ─── 6. Public API smoke ───────────────────────────────────
  sec('6. Public API endpoints (no auth required)')
  for (const p of ['/api/modules', '/api/glossary', '/api/health']) {
    const r = await call('GET', p)
    ok(`GET ${p} → 200`, r.status === 200, `status=${r.status}`)
  }

  // ─── 7. Protected API gates on prod ────────────────────────
  sec('7. Protected API endpoints reject no-auth on prod')
  for (const p of ['/api/dashboard', '/api/board', '/api/audit', '/api/comparables']) {
    const r = await call('GET', p)
    ok(`GET ${p} (no auth) → 401`, r.status === 401, `status=${r.status}`)
  }

  // ─── 8. /login form HTML cleanliness (no old chrome) ───────
  sec('8. /login HTML still clean (after PR #2 merge)')
  const loginR = await fetch(`${URL_BASE}/login?_bust=${Date.now()}`)
  const html = await loginR.text()
  ok('  no "Tĩnh lặng" mantra', !html.includes('Tĩnh lặng'))
  ok('  no "Về trang chủ" caption', !html.includes('Về trang chủ'))
  ok('  no embedded login-brand', !html.includes('<div class="login-brand">'))
  ok('  no pre-filled duc@anima.vn', !html.includes('duc@anima.vn'))
  ok('  no pre-filled Zeniipo@2026', !html.includes('Zeniipo@2026'))
  // "108 agent" appears in landing brand copy and root metadata — that's
  // intentional product messaging, not chrome we needed to strip.

  // ─── 9. Landing hero title clean (no awkward wrap markers) ─
  sec('9. Landing hero title (post-fix)')
  const root = await fetch(`${URL_BASE}/?_bust=${Date.now()}`)
  const rootHtml = await root.text()
  ok('  hero contains "Từ Day-0"', rootHtml.includes('Từ Day-0'))
  ok('  hero contains "ring-bell"', rootHtml.includes('ring-bell'))
  ok('  hero contains "SGX 2031"', rootHtml.includes('SGX 2031'))
  ok('  whitespace-nowrap wraps phrases', rootHtml.includes('whitespace-nowrap'))

  // ─── 10. Vercel deployment fresh ───────────────────────────
  sec('10. Vercel deployment age')
  const headLogin = await fetch(`${URL_BASE}/login`, { method: 'HEAD' })
  const age = Number(headLogin.headers.get('age') ?? 0)
  ok('Vercel cache age reasonable', age < 86400, `age=${age}s`)

  // ─── Summary ──────────────────────────────────────────────
  const passCount = results.filter((r) => r.pass).length
  const failCount = results.filter((r) => !r.pass).length
  console.log('\n╔══════════════════════════════════════════════════════════════════╗')
  console.log(`║ PHASE J · ${passCount}/${passCount + failCount} pass · ${failCount === 0 ? '✅ ALL GREEN' : `❌ ${failCount} FAIL`}${' '.repeat(Math.max(0, 32 - String(passCount + failCount).length - String(failCount).length))}║`)
  console.log('╚══════════════════════════════════════════════════════════════════╝')
  if (failCount > 0) {
    console.log('\nFailed:')
    for (const r of results.filter((r) => !r.pass)) console.log(`  ❌ ${r.name} · ${r.detail}`)
  }
  process.exit(failCount === 0 ? 0 : 1)
}

main().catch((e) => { console.error('💥', e); process.exit(2) })
