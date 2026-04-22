import type { NextRequest } from 'next/server'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Loads trusted origins from env. Accepts comma-separated list in
 * TRUSTED_ORIGINS (e.g. "https://zeniipo.com,https://app.zeniipo.com").
 * Always includes zeniipo.com + www + Vercel preview alias.
 */
const BUILTIN_TRUSTED = [
  'https://zeniipo.com',
  'https://www.zeniipo.com',
  'https://zeniipo.vercel.app',
]

function getTrustedOrigins(): string[] {
  const raw = process.env.TRUSTED_ORIGINS || ''
  const envTrusted = raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
  return Array.from(new Set([...BUILTIN_TRUSTED, ...envTrusted]))
}

/** Allow any subdomain of zeniipo.com (e.g. app.zeniipo.com, academy.zeniipo.com). */
function isZeniipoSubdomain(origin: string): boolean {
  try {
    const url = new URL(origin)
    if (url.protocol !== 'https:') return false
    return url.host === 'zeniipo.com' || url.host.endsWith('.zeniipo.com')
  } catch {
    return false
  }
}

/**
 * CSRF check: for state-changing methods, Origin header MUST match Host
 * header (or be in the trusted-origin list).
 * GET/HEAD/OPTIONS always pass.
 *
 * Returns true = request is safe, false = reject.
 */
export function validateCsrf(req: NextRequest): boolean {
  const method = req.method.toUpperCase()
  if (SAFE_METHODS.has(method)) return true

  const origin = req.headers.get('origin')
  const host = req.headers.get('host')

  // No Origin — some server-to-server clients don't send it.
  // Check Referer as a fallback. If both missing on a state-changing
  // method, reject (likely CSRF or unknown client).
  if (!origin) {
    const referer = req.headers.get('referer')
    if (!referer) return false
    try {
      const refererHost = new URL(referer).host
      if (host && refererHost === host) return true
    } catch {
      return false
    }
    return false
  }

  // Parse Origin → compare host
  let originHost: string
  try {
    originHost = new URL(origin).host
  } catch {
    return false
  }

  if (host && originHost === host) return true

  // Trusted origins allow-list (prod multi-subdomain setups)
  const trusted = getTrustedOrigins()
  if (trusted.includes(origin)) return true

  // Any HTTPS subdomain of zeniipo.com is trusted
  if (isZeniipoSubdomain(origin)) return true

  return false
}
