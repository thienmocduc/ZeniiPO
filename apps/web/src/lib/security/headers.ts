import type { NextResponse } from 'next/server'

/**
 * OWASP Top 10 security headers.
 * CSP allow-lists only what Zeniipo genuinely needs:
 * - Supabase (auth/data), Stripe (payments), Upstash (rate-limit), Anthropic (AI), Google Fonts.
 */
export const securityHeaders: Record<string, string> = {
  'Content-Security-Policy':
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://js.stripe.com https://*.supabase.co; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com data:; " +
    "img-src 'self' data: https: blob:; " +
    "connect-src 'self' https://*.supabase.co https://api.anthropic.com https://api.stripe.com https://*.upstash.io; " +
    "frame-src https://js.stripe.com; " +
    "frame-ancestors 'none'",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-XSS-Protection': '1; mode=block',
}

/**
 * Applies all OWASP security headers to a NextResponse.
 * Safe to call multiple times (last-write-wins).
 */
export function applyHeaders(res: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(securityHeaders)) {
    res.headers.set(key, value)
  }
  return res
}
