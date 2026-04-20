#!/usr/bin/env node
/**
 * Zeniipo · Supabase migration runner
 * Usage: node scripts/migrate.mjs [--reset]
 * Reads migrations from packages/database/supabase/migrations/*.sql in order
 * Connects via DATABASE_DIRECT_URL (session mode pooler port 5432) with service role
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

// Load .env.local
dotenv.config({ path: path.join(ROOT, '.env.local') })

const DB_URL = process.env.DATABASE_DIRECT_URL
if (!DB_URL) {
  console.error('❌ DATABASE_DIRECT_URL not set in .env.local')
  process.exit(1)
}

const MIGRATIONS_DIR = path.join(ROOT, 'packages/database/supabase/migrations')
const files = fs
  .readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort()

const reset = process.argv.includes('--reset')

const { Client } = pg
const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })

async function run() {
  console.log(`🔌 Connecting to Supabase database...`)
  await client.connect()
  console.log(`✅ Connected\n`)

  if (reset) {
    console.log(`⚠️  RESETTING public schema (--reset flag)`)
    await client.query(`DROP SCHEMA IF EXISTS public CASCADE;`)
    await client.query(`CREATE SCHEMA public;`)
    await client.query(`GRANT ALL ON SCHEMA public TO postgres, anon, authenticated, service_role;`)
    console.log(`✅ Public schema reset\n`)
  }

  for (const file of files) {
    const filePath = path.join(MIGRATIONS_DIR, file)
    const sql = fs.readFileSync(filePath, 'utf8')
    const startTime = Date.now()
    try {
      console.log(`▶  Running ${file} (${sql.split('\n').length} lines)...`)
      await client.query(sql)
      const duration = ((Date.now() - startTime) / 1000).toFixed(1)
      console.log(`   ✅ ${file} done in ${duration}s\n`)
    } catch (err) {
      console.error(`   ❌ ${file} failed:`)
      console.error(`   ${err.message}`)
      if (err.position) {
        const lines = sql.split('\n')
        let pos = 0
        for (let i = 0; i < lines.length; i++) {
          pos += lines[i].length + 1
          if (pos >= err.position) {
            console.error(`   @ line ~${i + 1}: ${lines[i]}`)
            break
          }
        }
      }
      await client.end()
      process.exit(1)
    }
  }

  // Verify
  const res = await client.query(
    `SELECT COUNT(*) AS tables FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
  )
  const funcRes = await client.query(
    `SELECT COUNT(*) AS funcs FROM pg_proc WHERE pronamespace = 'public'::regnamespace`,
  )
  console.log(`📊 Verification:`)
  console.log(`   Public tables: ${res.rows[0].tables}`)
  console.log(`   Public functions: ${funcRes.rows[0].funcs}`)

  await client.end()
  console.log(`\n🎉 Migration complete`)
}

run().catch(async (err) => {
  console.error(`💥 Fatal:`, err)
  await client.end().catch(() => {})
  process.exit(1)
})
