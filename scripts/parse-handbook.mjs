#!/usr/bin/env node
/**
 * Zeniipo · Handbook parser & seeder
 * Usage: node scripts/parse-handbook.mjs
 *
 * Reads _source/zeniipo_ipo_handbook_v1_1.html
 * Extracts embedded JS objects (PHASES, PHASE_CONTENT)
 * Upserts Supabase `phase_content` rows (phase 1-10, sections a/b/c/d)
 * Creates `case_studies` table if missing and inserts entries
 *
 * Connects via DATABASE_DIRECT_URL from .env.local (same approach as migrate.mjs)
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

const SOURCE_FILE = path.join(ROOT, '_source/zeniipo_ipo_handbook_v1_1.html')

// ═════════════════════════════════════════════
// Utility: extract a JS object literal from source by finding balanced braces
// ═════════════════════════════════════════════
function extractObjectLiteral(source, startMarker) {
  const idx = source.indexOf(startMarker)
  if (idx === -1) throw new Error(`Marker not found: ${startMarker}`)
  // Find first '{' after marker
  let braceStart = source.indexOf('{', idx)
  if (braceStart === -1) throw new Error(`Opening brace not found after ${startMarker}`)

  // Walk to find matching closing brace, respecting strings/template literals/line comments/block comments
  let depth = 0
  let i = braceStart
  let inSingle = false
  let inDouble = false
  let inTpl = false
  let inLineComment = false
  let inBlockComment = false
  while (i < source.length) {
    const ch = source[i]
    const next = source[i + 1]
    const prev = source[i - 1]

    if (inLineComment) {
      if (ch === '\n') inLineComment = false
      i++
      continue
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false
        i += 2
        continue
      }
      i++
      continue
    }
    if (inSingle) {
      if (ch === '\\') {
        i += 2
        continue
      }
      if (ch === "'") inSingle = false
      i++
      continue
    }
    if (inDouble) {
      if (ch === '\\') {
        i += 2
        continue
      }
      if (ch === '"') inDouble = false
      i++
      continue
    }
    if (inTpl) {
      if (ch === '\\') {
        i += 2
        continue
      }
      if (ch === '`') inTpl = false
      i++
      continue
    }

    // Not in any quote/comment
    if (ch === '/' && next === '/') {
      inLineComment = true
      i += 2
      continue
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true
      i += 2
      continue
    }
    if (ch === "'") {
      inSingle = true
      i++
      continue
    }
    if (ch === '"') {
      inDouble = true
      i++
      continue
    }
    if (ch === '`') {
      inTpl = true
      i++
      continue
    }
    if (ch === '{') {
      depth++
      i++
      continue
    }
    if (ch === '}') {
      depth--
      i++
      if (depth === 0) {
        return source.slice(braceStart, i)
      }
      continue
    }
    i++
  }
  throw new Error(`Unbalanced braces extracting ${startMarker}`)
}

// ═════════════════════════════════════════════
// Parse the JS literal into a real JS object via new Function
// Safe because source file is a trusted local artefact (not user input)
// ═════════════════════════════════════════════
function evalObjectLiteral(src) {
  // new Function lets us evaluate an object literal expression
  // Template literals survive untouched
  // eslint-disable-next-line no-new-func
  return new Function(`"use strict"; return (${src});`)()
}

// ═════════════════════════════════════════════
// Tier + duration lookup by phase
// ═════════════════════════════════════════════
const TIER_BY_PHASE = {
  1: 'explorer',
  2: 'explorer',
  3: 'pro',
  4: 'pro',
  5: 'pro',
  6: 'elite',
  7: 'elite',
  8: 'elite',
  9: 'enterprise',
  10: 'enterprise',
}
const DURATION_BY_PHASE = [6, 12, 12, 12, 12, 12, 12, 12, 18, 0]

// section code mapping a/b/c/d → P{n}-S1..S4
const SECTION_CODES = { a: 'S1', b: 'S2', c: 'S3', d: 'S4' }
const ORDER_IDX = { a: 1, b: 2, c: 3, d: 4 }

function placeholderTitle(section) {
  switch (section) {
    case 'a':
      return 'Bản chất phase'
    case 'b':
      return 'Checklist chi tiết'
    case 'c':
      return 'Zeniipo thực hành · Modules'
    case 'd':
      return 'Case study'
    default:
      return 'Nội dung'
  }
}

async function run() {
  // Load handbook HTML
  console.log(`📂 Reading ${path.relative(ROOT, SOURCE_FILE)}...`)
  const html = fs.readFileSync(SOURCE_FILE, 'utf8')
  console.log(`   ${html.length.toLocaleString()} bytes\n`)

  // Extract PHASES and PHASE_CONTENT literals
  console.log(`🔍 Extracting JS object literals...`)
  const phasesSrc = extractObjectLiteral(html, 'const PHASES')
  const phaseContentSrc = extractObjectLiteral(html, 'const PHASE_CONTENT')
  console.log(`   PHASES literal: ${phasesSrc.length} chars`)
  console.log(`   PHASE_CONTENT literal: ${phaseContentSrc.length} chars\n`)

  const PHASES = evalObjectLiteral(phasesSrc)
  const PHASE_CONTENT = evalObjectLiteral(phaseContentSrc)

  const phaseKeys = Object.keys(PHASES).sort((a, b) => PHASES[a].num - PHASES[b].num)
  console.log(`   Parsed ${phaseKeys.length} phases: ${phaseKeys.join(', ')}`)
  const realContentKeys = Object.keys(PHASE_CONTENT)
  console.log(`   PHASE_CONTENT keys (real data): ${realContentKeys.join(', ')}\n`)

  // ═════════════════════════════════════════════
  // Connect DB
  // ═════════════════════════════════════════════
  const { Client } = pg
  const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })
  console.log(`🔌 Connecting to Supabase database...`)
  await client.connect()
  console.log(`✅ Connected\n`)

  // Ensure case_studies exists
  console.log(`🛠  Ensuring case_studies table exists...`)
  await client.query(`
    CREATE TABLE IF NOT EXISTS case_studies (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_name text NOT NULL,
      kind text CHECK (kind IN ('win','loss','local')),
      industry text,
      home_country text,
      ipo_venue text,
      ipo_year int,
      valuation_usd numeric,
      phase_num int,
      title_vi text NOT NULL,
      title_en text,
      summary_vi text,
      summary_en text,
      lessons jsonb DEFAULT '[]'::jsonb,
      created_at timestamptz DEFAULT now()
    );
  `)
  // Idempotency: clear existing before reseed so re-running doesn't pile up dupes
  await client.query(`DELETE FROM case_studies;`)
  console.log(`   ✅ case_studies table ready (cleared existing rows)\n`)

  // ═════════════════════════════════════════════
  // Upsert phase_content for each phase 1..10, sections a/b/c/d
  // ═════════════════════════════════════════════
  let phaseContentInserted = 0
  let phaseContentPlaceholder = 0
  let caseStudyInserted = 0
  const realDataPhases = []
  const placeholderPhases = []

  for (let n = 1; n <= 10; n++) {
    const key = `p${n}`
    const phaseMeta = PHASES[key]
    if (!phaseMeta) {
      console.warn(`   ⚠  PHASES.${key} missing, skipping`)
      continue
    }
    const tier = TIER_BY_PHASE[n]
    const duration = DURATION_BY_PHASE[n - 1]
    const content = PHASE_CONTENT[key] || null
    const hasRealData = !!content
    if (hasRealData) realDataPhases.push(n)
    else placeholderPhases.push(n)

    for (const sub of ['a', 'b', 'c', 'd']) {
      const sectionCode = `P${n}-${SECTION_CODES[sub]}`
      const orderIdx = ORDER_IDX[sub]
      let titleVi, bodyVi, actionSteps

      if (content && content[sub]) {
        titleVi = content[sub].title || placeholderTitle(sub)
        if (sub === 'a') {
          bodyVi = content[sub].body || ''
          actionSteps = []
        } else if (sub === 'b') {
          bodyVi = ''
          actionSteps = Array.isArray(content[sub].steps) ? content[sub].steps : []
        } else if (sub === 'c') {
          // modules used in this phase — store as JSON in body for now
          const mods = Array.isArray(content[sub].mods) ? content[sub].mods : []
          bodyVi = JSON.stringify(mods)
          actionSteps = []
        } else if (sub === 'd') {
          // case study summary rendered later — body stays empty (detail lives in case_studies)
          bodyVi = ''
          actionSteps = []
        }
      } else {
        // Placeholder for TBD phase
        titleVi = `${placeholderTitle(sub)} — Phase ${n} (TBD)`
        bodyVi =
          `<p><em>Nội dung chi tiết Phase ${n} đang được soạn thảo. Tham khảo tổng quan: ` +
          (phaseMeta.lede || '') +
          `</em></p>`
        actionSteps = []
        phaseContentPlaceholder++
      }

      const titleEn = `[EN] ${stripInlineVn(titleVi)}`
      const bodyEn = bodyVi ? `[EN] ${stripInlineVn(bodyVi).slice(0, 2000)}` : ''

      await client.query(
        `INSERT INTO phase_content
           (phase_num, section_code, order_idx, title_vi, title_en, body_vi, body_en, action_steps, tier, duration_months)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10)
         ON CONFLICT (phase_num, section_code) DO UPDATE SET
           order_idx = EXCLUDED.order_idx,
           title_vi = EXCLUDED.title_vi,
           title_en = EXCLUDED.title_en,
           body_vi = EXCLUDED.body_vi,
           body_en = EXCLUDED.body_en,
           action_steps = EXCLUDED.action_steps,
           tier = EXCLUDED.tier,
           duration_months = EXCLUDED.duration_months`,
        [
          n,
          sectionCode,
          orderIdx,
          titleVi,
          titleEn,
          bodyVi,
          bodyEn,
          JSON.stringify(actionSteps),
          tier,
          duration,
        ],
      )
      phaseContentInserted++
    }

    // Insert case_studies from section d
    if (content && content.d && Array.isArray(content.d.cases)) {
      for (const cs of content.d.cases) {
        const companyName = cs.name || cs.label || 'Unknown'
        const kind = cs.kind || null
        const titleVi = cs.label ? `${cs.label}: ${cs.name}` : cs.name || 'Case'
        const summaryVi = [cs.sub ? `<p><em>${cs.sub}</em></p>` : '', cs.body || ''].filter(Boolean).join('\n')
        const lessons = cs.lesson ? [cs.lesson] : []

        await client.query(
          `INSERT INTO case_studies
             (company_name, kind, phase_num, title_vi, title_en, summary_vi, summary_en, lessons)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
          [
            companyName,
            kind,
            n,
            titleVi,
            `[EN] ${stripInlineVn(titleVi)}`,
            summaryVi,
            summaryVi ? `[EN] ${stripInlineVn(summaryVi).slice(0, 2000)}` : '',
            JSON.stringify(lessons),
          ],
        )
        caseStudyInserted++
      }
    }
  }

  // ═════════════════════════════════════════════
  // Verify
  // ═════════════════════════════════════════════
  console.log(`\n📊 Verification:`)
  const res1 = await client.query(
    `SELECT phase_num, COUNT(*)::int AS n FROM phase_content GROUP BY phase_num ORDER BY phase_num`,
  )
  for (const row of res1.rows) {
    console.log(`   phase_content · phase ${row.phase_num}: ${row.n} rows`)
  }
  const res2 = await client.query(`SELECT COUNT(*)::int AS n FROM case_studies`)
  console.log(`   case_studies total: ${res2.rows[0].n} rows`)

  console.log(`\n📝 Summary:`)
  console.log(`   phase_content inserted/updated: ${phaseContentInserted}`)
  console.log(`   phase_content placeholder rows: ${phaseContentPlaceholder}`)
  console.log(`   case_studies inserted: ${caseStudyInserted}`)
  console.log(`   Phases with real data: ${realDataPhases.join(', ') || '(none)'}`)
  console.log(`   Phases with placeholder: ${placeholderPhases.join(', ') || '(none)'}`)

  await client.end()
  console.log(`\n🎉 Parse + seed complete`)
}

// Strip inline <i class="vn">...</i> annotations for EN placeholder text
function stripInlineVn(html) {
  if (!html) return ''
  return html
    .replace(/<i class="vn">[\s\S]*?<\/i>/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

run().catch(async (err) => {
  console.error(`💥 Fatal:`, err)
  process.exit(1)
})
