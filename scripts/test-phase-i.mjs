#!/usr/bin/env node
/**
 * Phase I — Production prep backtest.
 *   - manifest.webmanifest served + valid PWA fields
 *   - icon endpoints render PNG
 *   - 3 cron endpoints reject without auth header
 *   - Cron auth accepts Bearer CRON_SECRET (if set) or x-vercel-cron:1
 *   - Service-role client only callable server-side (lib presence check)
 *   - vercel.json crons schedule registered
 */
import dotenv from 'dotenv'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const ROOT = path.resolve(path.dirname(__filename), '..')
dotenv.config({ path: path.join(ROOT, '.env.local') })

const URL_BASE = process.argv.find((a) => a.startsWith('--url='))?.slice(6) || 'http://localhost:3000'

const results = []
const ok = (n, c, d = '') => { results.push({ name: n, pass: c, detail: d }); console.log(`${c ? '✅' : '❌'} ${n}${d ? ' · ' + d : ''}`) }
const sec = (t) => console.log(`\n━━━ ${t} ━━━`)

async function call(method, path, opts = {}) {
  const headers = { ...(opts.headers ?? {}) }
  const init = { method, headers, redirect: 'manual' }
  const r = await fetch(`${URL_BASE}${path}`, init)
  const ct = r.headers.get('content-type') ?? ''
  let body = ''
  if (ct.includes('json')) body = await r.text()
  else if (ct.includes('text')) body = await r.text()
  else body = `<binary ${(await r.arrayBuffer()).byteLength}b>`
  return { status: r.status, body, headers: r.headers, contentType: ct }
}

async function main() {
  console.log(`🔬 Phase I · Production prep @ ${URL_BASE}\n`)

  // ─── 1. PWA manifest ────────────────────────────────────────
  sec('1. PWA manifest.webmanifest')
  const m = await call('GET', '/manifest.webmanifest')
  ok('GET /manifest.webmanifest → 200', m.status === 200, `ct=${m.contentType}`)
  ok('  is JSON content-type', m.contentType.includes('json') || m.contentType.includes('manifest'))
  let manifest = null
  try { manifest = JSON.parse(m.body) } catch {}
  ok('  parses as JSON', !!manifest)
  if (manifest) {
    ok('  has name', typeof manifest.name === 'string' && manifest.name.length > 0, manifest.name)
    ok('  has short_name', typeof manifest.short_name === 'string')
    ok('  start_url present', typeof manifest.start_url === 'string', manifest.start_url)
    ok('  display=standalone', manifest.display === 'standalone')
    ok('  theme_color set', typeof manifest.theme_color === 'string')
    ok('  background_color set', typeof manifest.background_color === 'string')
    ok('  icons array length ≥ 3', Array.isArray(manifest.icons) && manifest.icons.length >= 3, `icons=${manifest.icons?.length}`)
    ok('  has 192px icon', manifest.icons?.some((i) => i.sizes === '192x192'))
    ok('  has 512px icon', manifest.icons?.some((i) => i.sizes === '512x512'))
    ok('  has maskable purpose', manifest.icons?.some((i) => i.purpose?.includes('maskable')))
    ok('  shortcuts ≥ 3', Array.isArray(manifest.shortcuts) && manifest.shortcuts.length >= 3, `count=${manifest.shortcuts?.length}`)
  }

  // ─── 2. Icon endpoints ──────────────────────────────────────
  sec('2. Icon endpoints (PNG)')
  for (const p of ['/icon', '/icon-512', '/apple-icon']) {
    const r = await call('GET', p)
    ok(`GET ${p} → 200 + image`, r.status === 200 && r.contentType.includes('image'), `status=${r.status} ct=${r.contentType}`)
  }

  // ─── 3. Root metadata.manifest link ────────────────────────
  sec('3. Root layout viewport + manifest link')
  const root = await call('GET', '/')
  ok('GET / → 200', root.status === 200)
  ok('  HTML contains manifest link', root.body.includes('manifest.webmanifest') || root.body.includes('"manifest"'))
  ok('  apple-mobile-web-app-capable meta', root.body.includes('apple-mobile-web-app-capable') || root.body.includes('mobile-web-app-capable'))
  ok('  viewport has width=device-width', root.body.includes('width=device-width'))

  // ─── 4. Cron auth gate (3 endpoints) ───────────────────────
  sec('4. Cron auth gate')
  for (const p of ['/api/cron/audit-retention', '/api/cron/readiness-recalc', '/api/cron/weekly-digest']) {
    const noHeader = await call('GET', p)
    ok(`GET ${p} (no header) → 403`, noHeader.status === 403, `status=${noHeader.status}`)

    const fakeVercelHeader = await call('GET', p, { headers: { 'x-vercel-cron': '0' } })
    ok(`GET ${p} (x-vercel-cron=0) → 403`, fakeVercelHeader.status === 403)

    const wrongBearer = await call('GET', p, { headers: { Authorization: 'Bearer fake-secret-xxx' } })
    ok(`GET ${p} (wrong Bearer) → 403`, wrongBearer.status === 403)

    if (process.env.CRON_SECRET) {
      const goodBearer = await call('GET', p, { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } })
      ok(`GET ${p} (valid CRON_SECRET) → 200`, goodBearer.status === 200, `status=${goodBearer.status}`)
    }

    const goodVercelHeader = await call('GET', p, { headers: { 'x-vercel-cron': '1' } })
    ok(`GET ${p} (x-vercel-cron=1) → 200`, goodVercelHeader.status === 200, `status=${goodVercelHeader.status}`)
  }

  // ─── 5. vercel.json cron schedule ──────────────────────────
  sec('5. vercel.json crons declared')
  const vercelJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'))
  ok('vercel.json has crons array', Array.isArray(vercelJson.crons))
  ok('  3 cron entries', vercelJson.crons?.length === 3, `count=${vercelJson.crons?.length}`)
  for (const expected of ['weekly-digest', 'audit-retention', 'readiness-recalc']) {
    ok(`  cron registered: ${expected}`, vercelJson.crons?.some((c) => c.path?.includes(expected)))
  }
  ok('  every cron has cron schedule', vercelJson.crons?.every((c) => typeof c.schedule === 'string' && c.schedule.split(' ').length === 5))
  ok('  region pinned to sin1', vercelJson.regions?.includes('sin1'))

  // ─── 6. Service-role client lib presence ───────────────────
  sec('6. Service-role lib + cron auth helper')
  const serviceFile = path.join(ROOT, 'apps/web/src/lib/supabase/service.ts')
  ok('lib/supabase/service.ts exists', fs.existsSync(serviceFile))
  const serviceSrc = fs.readFileSync(serviceFile, 'utf8')
  ok('  exports createServiceClient', serviceSrc.includes('createServiceClient'))
  ok('  uses SUPABASE_SERVICE_ROLE_KEY', serviceSrc.includes('SUPABASE_SERVICE_ROLE_KEY'))
  ok('  warns about safe usage', serviceSrc.includes('cron') || serviceSrc.includes('webhook') || serviceSrc.includes('verified'))

  const cronAuthFile = path.join(ROOT, 'apps/web/src/lib/cron/auth.ts')
  ok('lib/cron/auth.ts exists', fs.existsSync(cronAuthFile))
  const cronSrc = fs.readFileSync(cronAuthFile, 'utf8')
  ok('  isAuthorizedCron checks x-vercel-cron', cronSrc.includes('x-vercel-cron'))
  ok('  isAuthorizedCron checks Bearer CRON_SECRET', cronSrc.includes('CRON_SECRET'))

  // ─── 7. PWA installability headers ─────────────────────────
  sec('7. Manifest serve headers')
  ok('manifest content-type is application/manifest+json or json', m.contentType.includes('manifest') || m.contentType.includes('json'))

  const passCount = results.filter((r) => r.pass).length
  const failCount = results.filter((r) => !r.pass).length
  console.log('\n╔══════════════════════════════════════════════════════════════════╗')
  console.log(`║ PHASE I · ${passCount}/${passCount + failCount} pass · ${failCount === 0 ? '✅ ALL GREEN' : `❌ ${failCount} FAIL`}${' '.repeat(Math.max(0, 32 - String(passCount + failCount).length - String(failCount).length))}║`)
  console.log('╚══════════════════════════════════════════════════════════════════╝')
  if (failCount > 0) {
    console.log('\nFailed:')
    for (const r of results.filter((r) => !r.pass)) console.log(`  ❌ ${r.name} · ${r.detail}`)
  }
  process.exit(failCount === 0 ? 0 : 1)
}

main().catch((e) => { console.error('💥', e); process.exit(2) })
