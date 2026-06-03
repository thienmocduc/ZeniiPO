#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import pg from 'pg'
import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const __filename = fileURLToPath(import.meta.url)
dotenv.config({ path: path.join(path.resolve(path.dirname(__filename), '..'), '.env.local') })

const ADMIN = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const SB = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const results = []
const ok = (n, c, d='') => { results.push({n,c}); console.log(`${c?'✅':'❌'} ${n}${d?' · '+d:''}`) }

async function main() {
  console.log('🔬 Journey Engine test\n')
  const ts = Date.now()
  const email = `journey-${ts}@zeniipo-test.example.com`
  const pw = 'Journey_2026!Strong'
  const su = await ADMIN.auth.admin.createUser({ email, password: pw, email_confirm: true,
    user_metadata: { full_name: 'Journey Test', company_name: 'Journey Co', role: 'chr' } })
  const userId = su.data.user.id
  await new Promise(r => setTimeout(r, 1500))
  const pgc = new pg.Client({ connectionString: process.env.DATABASE_DIRECT_URL, ssl: { rejectUnauthorized: false } })
  await pgc.connect()
  const tid = (await pgc.query('SELECT tenant_id FROM user_profiles WHERE id=$1', [userId])).rows[0].tenant_id
  ok('User + tenant created', !!tid)

  await SB.auth.signInWithPassword({ email, password: pw })

  // 1. init journey
  const init = await SB.rpc('init_tenant_journey', { p_tenant_id: tid })
  ok('init_tenant_journey → 7 levels', init.data?.levels === 7, JSON.stringify(init.data))

  // 2. get state — L1 learning, rest locked
  let state = (await SB.rpc('get_journey_state', { p_tenant_id: tid })).data
  ok('L1 state = learning', state[0].state === 'learning', `L1=${state[0].state}`)
  ok('L2 state = locked', state[1].state === 'locked')
  ok('7 levels returned', state.length === 7)

  // 3. evaluate gate L1 (not ready)
  let gate = (await SB.rpc('evaluate_level_gate', { p_tenant_id: tid, p_level_num: 1 })).data
  ok('L1 gate not unlockable yet', gate.can_unlock === false, `assessment_ok=${gate.assessment_ok} deliv_ok=${gate.deliverables_ok}`)

  // 4. submit assessment (pass)
  await SB.rpc('advance_level', { p_tenant_id: tid, p_level_num: 1, p_action: 'submit_assessment', p_score: 6, p_deliverable: null })
  state = (await SB.rpc('get_journey_state', { p_tenant_id: tid })).data
  ok('L1 after assessment = assessed', state[0].state === 'assessed', `L1=${state[0].state} score=${state[0].assessment_score}`)

  // 5. add deliverables (cap_table_v0 + readiness_baseline)
  await SB.rpc('advance_level', { p_tenant_id: tid, p_level_num: 1, p_action: 'add_deliverable', p_score: null, p_deliverable: { code: 'cap_table_v0', label: 'Cap table v0' } })
  gate = (await SB.rpc('evaluate_level_gate', { p_tenant_id: tid, p_level_num: 1 })).data
  ok('L1 still missing 1 deliverable', gate.can_unlock === false, `missing=${gate.missing_deliverables?.length}`)

  const adv = await SB.rpc('advance_level', { p_tenant_id: tid, p_level_num: 1, p_action: 'add_deliverable', p_score: null, p_deliverable: { code: 'readiness_baseline', label: 'Readiness baseline' } })
  ok('L1 now can_unlock after all deliverables', adv.data?.can_unlock === true, `can_unlock=${adv.data?.can_unlock}`)

  // 6. verify auto-unlock + next level opened
  state = (await SB.rpc('get_journey_state', { p_tenant_id: tid })).data
  ok('L1 auto-unlocked', state[0].state === 'unlocked', `L1=${state[0].state}`)
  ok('L2 auto-opened to learning', state[1].state === 'learning', `L2=${state[1].state}`)

  // 7. event logged
  const ev = await pgc.query("SELECT count(*) FROM events WHERE tenant_id=$1 AND event_type='level_unlocked'", [tid])
  ok('level_unlocked event logged', Number(ev.rows[0].count) >= 1, `count=${ev.rows[0].count}`)

  // 8. RLS isolation — second tenant cannot read first
  const su2 = await ADMIN.auth.admin.createUser({ email: `journey2-${ts}@zeniipo-test.example.com`, password: pw, email_confirm: true, user_metadata: { role: 'chr', company_name: 'Other Co' } })
  await new Promise(r => setTimeout(r, 1200))
  const SB2 = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  await SB2.auth.signInWithPassword({ email: `journey2-${ts}@zeniipo-test.example.com`, password: pw })
  const cross = await SB2.rpc('get_journey_state', { p_tenant_id: tid })
  ok('Tenant B blocked from tenant A journey', !!cross.error, cross.error?.message?.slice(0,40) ?? 'NO ERROR (leak!)')

  // cleanup
  await ADMIN.auth.admin.deleteUser(userId)
  await ADMIN.auth.admin.deleteUser(su2.data.user.id)
  await pgc.end()

  const pass = results.filter(r=>r.c).length, fail = results.filter(r=>!r.c).length
  console.log(`\n╔═══════════════════════════════════════════════╗`)
  console.log(`║ JOURNEY ENGINE · ${pass}/${pass+fail} · ${fail===0?'✅ ALL GREEN':'❌ '+fail+' FAIL'}`)
  console.log(`╚═══════════════════════════════════════════════╝`)
  process.exit(fail===0?0:1)
}
main().catch(e => { console.error('💥', e); process.exit(2) })
