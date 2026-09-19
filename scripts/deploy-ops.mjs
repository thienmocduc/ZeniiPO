/**
 * deploy-ops.mjs — privileged production-deploy operations for zenicloud.io.
 *
 * Run ONE subcommand at a time so each external call is verified before the next:
 *   node scripts/deploy-ops.mjs status          # inspect current state (read-only)
 *   node scripts/deploy-ops.mjs vercel-domain   # attach zenicloud.io + www to the project
 *   node scripts/deploy-ops.mjs dns             # point Namecheap NS -> Vercel (delegates DNS+SSL)
 *   node scripts/deploy-ops.mjs supabase-auth   # set Supabase SITE_URL + redirect allow-list
 *   node scripts/deploy-ops.mjs migrate         # apply migration 023 (parent_tenant_id)
 *
 * Reads creds from .env.local + the Vercel CLI auth file. No secret is printed.
 * Chairman authorized (2026-06-04): production target is zenicloud.io ONLY.
 */
import fs from 'node:fs'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const APEX = 'zenicloud.io'
const SLD = 'zenicloud', TLD = 'io'
const PROJECT_ID = 'prj_pRvc5dkmXtaoDlxErf6XGsHSJZD8'
const TEAM_ID = 'team_5x9m34Ihn6TpzsmzVXDcam0a'
const VERCEL_NS = ['ns1.vercel-dns.com', 'ns2.vercel-dns.com']

function vercelToken() {
  const p = process.env.APPDATA
    ? `${process.env.APPDATA}/com.vercel.cli/Data/auth.json`
    : `${process.env.HOME}/.config/com.vercel.cli/auth.json`
  return JSON.parse(fs.readFileSync(p, 'utf8')).token
}
const vh = () => ({ Authorization: `Bearer ${vercelToken()}`, 'Content-Type': 'application/json' })

async function myIp() {
  const r = await fetch('https://api.ipify.org')
  return (await r.text()).trim()
}

const NC = process.env // namecheap creds
function ncUrl(command, extra = {}) {
  const q = new URLSearchParams({
    ApiUser: NC.NAMECHEAP_API_USER, ApiKey: NC.NAMECHEAP_API_KEY,
    UserName: NC.NAMECHEAP_USERNAME, Command: command, ...extra,
  })
  return `https://api.namecheap.com/xml.response?${q}`
}

// ── status ───────────────────────────────────────────────────────
async function status() {
  console.log('IP:', await myIp())
  // Vercel: is domain on the project?
  const r = await fetch(`https://api.vercel.com/v9/projects/${PROJECT_ID}/domains?teamId=${TEAM_ID}`, { headers: vh() })
  const j = await r.json()
  const names = (j.domains ?? []).map((d) => d.name)
  console.log('Project domains:', names.join(', ') || '(none)')
  console.log('zenicloud.io on project?', names.includes(APEX) ? 'YES' : 'NO')
  // Vercel: domain config (DNS verification)
  const cfg = await (await fetch(`https://api.vercel.com/v6/domains/${APEX}/config?teamId=${TEAM_ID}`, { headers: vh() })).json()
  console.log('DNS misconfigured?', cfg.misconfigured, '| nameservers:', JSON.stringify(cfg.nameservers))
  // Namecheap NS
  const ns = await (await fetch(ncUrl('namecheap.domains.dns.getList', { SLD, TLD, ClientIp: await myIp() }))).text()
  console.log('Namecheap getList ok?', ns.includes('Status="OK"'))
}

// ── attach domain to project ─────────────────────────────────────
async function vercelDomain() {
  for (const name of [APEX, `www.${APEX}`]) {
    const r = await fetch(`https://api.vercel.com/v10/projects/${PROJECT_ID}/domains?teamId=${TEAM_ID}`, {
      method: 'POST', headers: vh(), body: JSON.stringify({ name }),
    })
    const j = await r.json()
    if (r.ok) console.log(`✓ attached ${name}`)
    else if (j.error?.code === 'domain_already_in_use' || /already/i.test(j.error?.message ?? '')) console.log(`• ${name} already attached`)
    else console.log(`✗ ${name}:`, j.error?.message ?? JSON.stringify(j))
  }
  const cfg = await (await fetch(`https://api.vercel.com/v6/domains/${APEX}/config?teamId=${TEAM_ID}`, { headers: vh() })).json()
  console.log('After attach — misconfigured:', cfg.misconfigured)
}

// ── DNS: delegate to Vercel nameservers (cleanest for app-only domain) ──
async function dns() {
  const ip = await myIp()
  // Safety: show current hosts first (BasicDNS) so we know what we'd replace.
  const cur = await (await fetch(ncUrl('namecheap.domains.dns.getHosts', { SLD, TLD, ClientIp: ip }))).text()
  const hosts = [...cur.matchAll(/<host\b[^>]*\/>/g)].map((m) => m[0])
  console.log(`Current Namecheap host records (${hosts.length}):`)
  hosts.forEach((h) => console.log('  ', h.replace(/\s+/g, ' ')))
  // Delegate NS to Vercel — Vercel then manages A/CNAME + SSL automatically.
  const r = await fetch(ncUrl('namecheap.domains.dns.setCustom', { SLD, TLD, ClientIp: ip, Nameservers: VERCEL_NS.join(',') }))
  const xml = await r.text()
  const ok = xml.includes('Updated="true"') || xml.includes('Status="OK"')
  console.log(ok ? `✓ Namecheap NS → Vercel (${VERCEL_NS.join(', ')}). DNS+SSL auto, propagation ~mins-hours.` : `✗ setCustom failed:\n${xml.slice(0, 600)}`)
}

// ── Supabase auth allow-list + site url ──────────────────────────
async function supabaseAuth() {
  const ref = process.env.SUPABASE_PROJECT_REF
  const tok = process.env.SUPABASE_ACCESS_TOKEN
  const body = {
    site_url: `https://${APEX}`,
    uri_allow_list: [
      `https://${APEX}`, `https://${APEX}/**`, `https://www.${APEX}/**`,
      'https://zeniipo.com/**', // legacy during transition
    ].join(','),
  }
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    method: 'PATCH', headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  const j = await r.json().catch(() => ({}))
  console.log(r.ok ? `✓ Supabase auth: site_url=${j.site_url ?? body.site_url}` : `✗ ${r.status}: ${JSON.stringify(j).slice(0, 300)}`)
}

// ── migration 023 ────────────────────────────────────────────────
async function migrate() {
  const { default: pg } = await import('pg')
  const c = new pg.Client({ connectionString: process.env.DATABASE_DIRECT_URL, ssl: { rejectUnauthorized: false } })
  await c.connect()
  const sql = fs.readFileSync('packages/database/supabase/migrations/023_holdings_parent.sql', 'utf8')
  await c.query(sql)
  const r = await c.query("SELECT sub.name, parent.name AS parent FROM tenants sub JOIN tenants parent ON parent.id=sub.parent_tenant_id ORDER BY sub.name")
  console.log('✓ migration 023 applied. Subsidiaries:', r.rows.map((x) => x.name).join(', ') || '(none)')
  await c.end()
}

const cmd = process.argv[2]
const fns = { status, 'vercel-domain': vercelDomain, dns, 'supabase-auth': supabaseAuth, migrate }
if (!fns[cmd]) { console.error('Usage: node scripts/deploy-ops.mjs <status|vercel-domain|dns|supabase-auth|migrate>'); process.exit(1) }
fns[cmd]().catch((e) => { console.error('✗', e.message); process.exit(1) })
