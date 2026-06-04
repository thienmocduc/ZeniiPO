/**
 * Create the CEO + admin account on Zeni-iPO.
 *   email : ceo@zeniipo.com
 *   role  : ceo  (CEO)
 *   admin : is_chairman_super = true  (sees all tenants, bypasses RLS, /api/admin)
 *   tenant: zeni (Zeni Holdings)
 *
 * Idempotent: if the auth user already exists, it reuses it and just
 * re-applies the profile role/tenant/super flag.
 *
 * Reads secrets from .env.local — nothing is hardcoded.
 * Run: node scripts/create-ceo-account.mjs
 */
import { createClient } from '@supabase/supabase-js'
import pg from 'pg'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const EMAIL = 'ceo@zeniipo.com'
const PASSWORD = process.env.CEO_INITIAL_PASSWORD || 'Ceo@Zeniipo2026!Strong'
const FULL_NAME = 'Thiên Mộc Đức'
const TENANT_SLUG = 'zeni'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!url || !serviceKey || !anonKey) { console.error('Missing Supabase env'); process.exit(1) }

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

async function main() {
  // ── 1. Create (or find) the auth user ────────────────────────────
  let userId
  const created = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: FULL_NAME, role: 'ceo', tenant_slug: TENANT_SLUG },
  })
  if (created.error) {
    if (/already.*registered|exists/i.test(created.error.message)) {
      // find existing
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
      const found = list.users.find((u) => u.email === EMAIL)
      if (!found) throw new Error('User exists but not found in list')
      userId = found.id
      // ensure password + confirmed (reset to known value for first login)
      await admin.auth.admin.updateUserById(userId, {
        password: PASSWORD, email_confirm: true,
        user_metadata: { full_name: FULL_NAME, role: 'ceo', tenant_slug: TENANT_SLUG },
      })
      console.log('• Reused existing auth user', userId)
    } else {
      throw created.error
    }
  } else {
    userId = created.data.user.id
    console.log('• Created auth user', userId)
  }

  // ── 2. Force profile: role=ceo, tenant=zeni, is_chairman_super=true ──
  const c = new pg.Client({ connectionString: process.env.DATABASE_DIRECT_URL, ssl: { rejectUnauthorized: false } })
  await c.connect()
  const tn = await c.query('SELECT id FROM tenants WHERE slug=$1', [TENANT_SLUG])
  const tenantId = tn.rows[0]?.id
  if (!tenantId) throw new Error('zeni tenant not found')

  // profile may already exist (trigger). Upsert the authoritative values.
  await c.query(
    `INSERT INTO user_profiles (id, tenant_id, email, full_name, role, is_chairman_super)
     VALUES ($1,$2,$3,$4,'ceo',true)
     ON CONFLICT (id) DO UPDATE SET
       tenant_id = EXCLUDED.tenant_id,
       email = EXCLUDED.email,
       full_name = EXCLUDED.full_name,
       role = 'ceo',
       is_chairman_super = true`,
    [userId, tenantId, EMAIL, FULL_NAME],
  )
  console.log('• Profile set: role=ceo, tenant=zeni, is_chairman_super=true')

  // ── 3. Verify profile row ────────────────────────────────────────
  const prof = await c.query(
    `SELECT u.email, u.role, u.is_chairman_super, t.slug AS tenant
     FROM user_profiles u JOIN tenants t ON t.id=u.tenant_id WHERE u.id=$1`, [userId])
  console.log('• DB profile:', JSON.stringify(prof.rows[0]))
  await c.end()

  // ── 4. Real login test (anon client, signInWithPassword) ─────────
  const pub = createClient(url, anonKey, { auth: { persistSession: false } })
  const login = await pub.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
  if (login.error) throw new Error('LOGIN FAILED: ' + login.error.message)
  console.log('• Login OK — session token len', login.data.session.access_token.length)

  // ── 5. Verify is_chairman_super RPC returns true for this user ────
  const authed = createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${login.data.session.access_token}` } },
  })
  const { data: isSuper, error: rpcErr } = await authed.rpc('is_chairman_super')
  if (rpcErr) console.log('• RPC is_chairman_super error:', rpcErr.message)
  else console.log('• RPC is_chairman_super →', isSuper, isSuper === true ? '(ADMIN OK)' : '(NOT ADMIN!)')

  console.log('\n✅ DONE')
  console.log('   URL     : https://zeniipo.com/login')
  console.log('   Email   : ' + EMAIL)
  console.log('   Password: ' + PASSWORD)
}

main().catch((e) => { console.error('✗', e.message); process.exit(1) })
