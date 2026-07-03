/** E2E: run the real Council of 9 system prompt against DeepSeek, verify JSON. */
import fs from 'node:fs'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const src = fs.readFileSync('apps/web/src/lib/agents/council-validator.ts', 'utf8')
const m = src.match(/COUNCIL_SYSTEM_PROMPT = `([\s\S]*?)`/)
if (!m) { console.error('could not extract COUNCIL_SYSTEM_PROMPT'); process.exit(1) }
const SYS = m[1]

const idea = {
  description: 'A SaaS that automates IPO readiness for Southeast Asian startups: cap table, 3-statement financial model, data room, and AI council validation in one platform.',
  industry: 'Fintech SaaS',
  market_size: 'TAM ~$8B SEA startup tooling, growing 22%/yr',
  competition: 'Carta, Notion — fragmented, not SEA-localized, no IPO journey',
}
const user = `IDEA DESCRIPTION\n${idea.description}\n\nINDUSTRY\n${idea.industry}\n\nMARKET SIZE\n${idea.market_size}\n\nCOMPETITION\n${idea.competition}\n\nEvaluate this idea using the nine-expert council. Return only JSON.`

const key = process.env.DEEPSEEK_API_KEY
const base = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
const t0 = Date.now()
const res = await fetch(base + '/chat/completions', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: 'deepseek-v4-pro', messages: [{ role: 'system', content: SYS }, { role: 'user', content: user }], max_tokens: 4096, temperature: 0.4 }),
})
const j = await res.json()
if (!res.ok) { console.error('DEEPSEEK FAIL', res.status, JSON.stringify(j).slice(0, 250)); process.exit(1) }
let text = (j.choices?.[0]?.message?.content ?? '').trim()
const fence = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
if (fence) text = fence[1].trim()
else { const a = text.indexOf('{'), b = text.lastIndexOf('}'); if (a !== -1 && b > a) text = text.slice(a, b + 1) }
let parsed
try { parsed = JSON.parse(text) } catch (e) { console.error('JSON PARSE FAIL:', e.message, '\nraw:', text.slice(0, 300)); process.exit(1) }

const ok = typeof parsed.overall_score === 'number' && Array.isArray(parsed.votes) && parsed.votes.length === 9 && typeof parsed.summary === 'string'
console.log(ok ? '✅ COUNCIL E2E OK' : '⚠️ schema mismatch')
console.log('overall_score:', parsed.overall_score, '· recommendation:', parsed.recommendation, '· votes:', parsed.votes?.length, '· dur', Date.now() - t0, 'ms · tokens', j.usage?.total_tokens)
console.log('summary:', (parsed.summary || '').slice(0, 180))
console.log('vote[0]:', JSON.stringify(parsed.votes?.[0]))
process.exit(ok ? 0 : 1)
