#!/usr/bin/env node
/**
 * Seed initial framework for ANIMA Care Global tenant.
 *
 * Idempotent: re-running upserts/skips existing rows. Adds the SKELETON only —
 * KPI rows with value=0, OKR titles, task placeholders. The chairman fills
 * real numbers via the dashboard / KPI matrix once logged in. We never invent
 * fake numbers.
 */
import pg from 'pg'
import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const ROOT = path.resolve(path.dirname(__filename), '..')
dotenv.config({ path: path.join(ROOT, '.env.local') })

const pool = new pg.Client({ connectionString: process.env.DATABASE_DIRECT_URL, ssl: { rejectUnauthorized: false } })
await pool.connect()
const q = (sql, params) => pool.query(sql, params)
const ANIMA_SLUG = 'anima'
const ANIMA_INDUSTRY = 'wellness'
const ANIMA_NORTH_STAR = 'Therapy sessions per month'

async function main() {
  // 1. Resolve tenant + journey
  const tRes = await q("SELECT id, name FROM tenants WHERE slug=$1", [ANIMA_SLUG])
  if (tRes.rows.length === 0) throw new Error(`tenant 'anima' not found`)
  const tenant = tRes.rows[0]
  console.log('✓ tenant:', tenant.id, '·', tenant.name)

  const jRes = await q(
    'SELECT id, name, industry, north_star_metric FROM ipo_journeys WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 1',
    [tenant.id],
  )
  if (jRes.rows.length === 0) {
    console.log('⚠ no journey yet — chairman must run onboarding wizard first')
    await pool.end()
    return
  }
  const journey = jRes.rows[0]
  console.log('✓ journey:', journey.id, '·', journey.name)

  // 2. Patch journey metadata
  const updates = []
  const params = []
  let n = 1
  if (!journey.industry) { updates.push(`industry=$${n++}`); params.push(ANIMA_INDUSTRY) }
  if (!journey.north_star_metric) { updates.push(`north_star_metric=$${n++}`); params.push(ANIMA_NORTH_STAR) }
  if (updates.length > 0) {
    params.push(journey.id)
    await q(`UPDATE ipo_journeys SET ${updates.join(', ')} WHERE id=$${n}`, params)
    console.log('  ✓ journey metadata patched:', updates.join(', '))
  } else {
    console.log('  → journey metadata already set, skipping')
  }

  // 3. KPI skeleton — 4 rows with value=0
  const period = new Date().toISOString().slice(0, 7)
  const KPIS = [
    { metric_code: 'therapy_sessions_month', name: 'Therapy sessions / month', value: 0, unit: 'sessions', category: 'product', trend: 'flat' },
    { metric_code: 'arr_usd', name: 'Annual Recurring Revenue', value: 0, unit: 'USD', category: 'financial', trend: 'flat' },
    { metric_code: 'monthly_burn', name: 'Monthly Burn', value: 0, unit: 'USD', category: 'financial', trend: 'flat' },
    { metric_code: 'fte_count', name: 'FTE Count', value: 0, unit: 'people', category: 'team', trend: 'flat' },
  ]
  const existingKpis = await q('SELECT metric_code FROM kpi_metrics WHERE tenant_id=$1', [tenant.id])
  const existingCodes = new Set(existingKpis.rows.map((r) => r.metric_code))
  const newKpis = KPIS.filter((k) => !existingCodes.has(k.metric_code))
  for (const k of newKpis) {
    await q(
      `INSERT INTO kpi_metrics (tenant_id, metric_code, name, category, value, unit, period, trend, captured_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())`,
      [tenant.id, k.metric_code, k.name, k.category, k.value, k.unit, period, k.trend],
    )
  }
  console.log(`  ✓ ${newKpis.length} new KPI rows · ${existingCodes.size} already present`)

  // 4. Tasks — 3 Phase 1 critical actions
  // tasks.priority allows only 't1' | 't2' | 't3' (Eisenhower-style)
  const TASKS = [
    { title: 'Engage Big 4 audit firm (PwC / KPMG / EY / Deloitte)', priority: 't1' },
    { title: 'Recruit CFO with public-company experience', priority: 't1' },
    { title: 'Document SOX/SGX internal control framework', priority: 't2' },
  ]
  const existingTasks = await q(`SELECT title FROM tasks WHERE title ILIKE 'Engage Big 4%'`)
  if (existingTasks.rows.length > 0) {
    console.log('  → tasks already seeded, skipping')
  } else {
    let inserted = 0
    for (const t of TASKS) {
      try {
        await q(
          `INSERT INTO tasks (tenant_id, title, priority, status) VALUES ($1, $2, $3, 'todo')`,
          [tenant.id, t.title, t.priority],
        )
        inserted++
      } catch (e) {
        console.log(`  ⚠ task "${t.title}" skipped: ${e.message.slice(0, 80)}`)
      }
    }
    console.log(`  ✓ ${inserted}/${TASKS.length} tasks inserted`)
  }

  // 5. Final state
  const final = await q(
    `SELECT (SELECT count(*) FROM kpi_metrics WHERE tenant_id=$1) AS kpis,
            (SELECT count(*) FROM okr_objectives WHERE tenant_id=$1) AS okrs,
            (SELECT count(*) FROM tasks) AS tasks_global`,
    [tenant.id],
  )
  console.log('\n✅ Anima seed complete:', final.rows[0])
  await pool.end()
}

main().catch(async (e) => { console.error(e); await pool.end(); process.exit(1) })
