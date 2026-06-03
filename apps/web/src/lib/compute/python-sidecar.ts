import crypto from 'node:crypto'

/**
 * Next.js → Python sidecar client.
 *
 * Next.js stays the single gateway: the browser never talks to the Python
 * service directly. This module signs a short-lived HS256 JWT (shared secret,
 * symmetric — same value the FastAPI side verifies) and forwards a compute
 * request. If PYTHON_SIDECAR_URL is unset, callers fall back to the in-process
 * TypeScript implementations (no fragmentation, no hard dependency).
 *
 * No external JWT dep — HS256 is built from node:crypto.
 */

const SIDECAR_URL = process.env.PYTHON_SIDECAR_URL ?? ''
const SHARED_SECRET = process.env.PYTHON_SHARED_SECRET ?? ''

export function isSidecarConfigured(): boolean {
  return Boolean(SIDECAR_URL && SHARED_SECRET && SHARED_SECRET.length >= 32)
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Sign a short-lived (5 min) HS256 JWT the FastAPI sidecar will accept. */
function signSidecarJwt(claims: { tenant_id: string; user_id: string; role: string }): string {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = b64url(JSON.stringify({ ...claims, iat: now, exp: now + 300 }))
  const data = `${header}.${payload}`
  const sig = b64url(crypto.createHmac('sha256', SHARED_SECRET).update(data).digest())
  return `${data}.${sig}`
}

export class SidecarNotConfiguredError extends Error {
  constructor() {
    super('PYTHON_SIDECAR_URL / PYTHON_SHARED_SECRET not configured')
    this.name = 'SidecarNotConfiguredError'
  }
}

type AuthClaims = { tenant_id: string; user_id: string; role: string }

async function call<T>(path: string, body: unknown, auth: AuthClaims, timeoutMs = 30_000): Promise<T> {
  if (!isSidecarConfigured()) throw new SidecarNotConfiguredError()
  const token = signSidecarJwt(auth)
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`${SIDECAR_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Zeniipo-Auth': `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      throw new Error(`sidecar ${path} → ${res.status}: ${txt.slice(0, 200)}`)
    }
    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

// ─── typed callers ──────────────────────────────────────────────
export type SidecarMonteCarloReq = {
  ar_growth_pct: number; churn_pct: number; gross_margin_pct: number
  ltv_cac_ratio: number; multiple: number; base_arr_usd?: number
  runs?: number; seed?: number; journey_id?: string
}
export function sidecarMonteCarlo(req: SidecarMonteCarloReq, auth: AuthClaims) {
  return call('/sensitivity/monte-carlo', req, auth)
}

export type SidecarCouncilReq = {
  idea: { description: string; industry: string; market_size: string; competition: string }
  extra_context?: string
}
export function sidecarCouncil(req: SidecarCouncilReq, auth: AuthClaims) {
  return call('/council/validate', req, auth, 60_000)
}

export type SidecarBatchReq = { agent_codes: string[]; prompt: string; mode?: 'fast' | 'standard' | 'deep'; journey_id?: string }
export function sidecarBatchAgents(req: SidecarBatchReq, auth: AuthClaims) {
  return call('/batch/agents', req, auth, 120_000)
}
