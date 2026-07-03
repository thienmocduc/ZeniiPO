/**
 * Deploy Zeni-iPO → ZeniCloud Compute via API (POST /deploy/quick).
 * Builds from the public GitHub repo using the repo-root Dockerfile.
 * Reads token + env from .env.local. Run: node scripts/deploy-zenicloud.mjs
 */
import dotenv from 'dotenv'
import fs from 'node:fs'
dotenv.config({ path: '.env.local' })

const API = process.env.ZENICLOUD_API
const WS = process.env.ZENICLOUD_WS
const TOK = process.env.ZENICLOUD_API_TOKEN
const hdr = { Authorization: `Bearer ${TOK}`, 'Content-Type': 'application/json' }

// Env vars the app needs to boot (Supabase backend kept for now).
const pick = (k) => process.env[k]
// PUBLIC env only — anon key + URL are shipped to the browser anyway (safe).
// SECRET vars (SERVICE_ROLE_KEY, DATABASE_URL) are set later via the project's
// env UI so they don't cross the deploy-API trust boundary (guard).
const env_vars = {
  NODE_ENV: 'production',
  NEXT_PUBLIC_SUPABASE_URL: pick('NEXT_PUBLIC_SUPABASE_URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: pick('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
}
for (const k of Object.keys(env_vars)) if (!env_vars[k]) delete env_vars[k]

const payload = {
  name: 'zeniipo',
  type: 'web',
  runtime: 'container',
  size: 's',
  region: 'asia-southeast1',
  zip_base64: fs.readFileSync('zeniipo-src.zip').toString('base64'),
  port: 3000,
  allow_unauthenticated: true,
  env_vars,
}

console.log('→ POST /deploy/quick (repo_url build, ' + Object.keys(env_vars).length + ' env vars)')
const res = await fetch(`${API}/deploy/quick?ws=${WS}`, { method: 'POST', headers: hdr, body: JSON.stringify(payload) })
const text = await res.text()
console.log('status', res.status)
console.log(text.slice(0, 800))

// Try to extract a deploy/project id for polling.
let id
try { const j = JSON.parse(text); id = j.id || j.deploy_id || j.project_id || j.deployment_id || j.data?.id } catch {}
if (id) console.log('\nDEPLOY_ID=' + id + '  → poll: GET /deploy/quick/' + id + '?ws=' + WS)
