import type { NextResponse } from 'next/server'

/**
 * OWASP Top 10 security headers for zenicloud.io.
 *
 * CSP allow-lists only what Zeniipo genuinely needs:
 * - zenicloud.io + *.zenicloud.io (self + all subdomains: app, api, admin, academy, ...)
 * - Legacy zeniipo.com kept temporarily for previous deploys + email links
 * - Supabase (auth/data), Stripe (payments), Upstash (rate-limit), Anthropic (AI)
 * - Google Fonts, Vercel analytics, Sentry
 */
export const securityHeaders: Record<string, string> = {
  'Content-Security-Policy':
    "default-src 'self' https://zenicloud.io https://*.zenicloud.io https://zeniipo.com https://*.zeniipo.com; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://zenicloud.io https://*.zenicloud.io https://zeniipo.com https://*.zeniipo.com https://js.stripe.com https://*.supabase.co https://va.vercel-scripts.com https://*.sentry.io https://browser.sentry-cdn.com; " +
    "style-src 'self' 'unsafe-inline' https://zenicloud.io https://*.zenicloud.io https://zeniipo.com https://*.zeniipo.com https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com data: https://zenicloud.io https://*.zenicloud.io https://zeniipo.com https://*.zeniipo.com; " +
    "img-src 'self' data: blob: https: https://zenicloud.io https://*.zenicloud.io https://zeniipo.com https://*.zeniipo.com; " +
    "connect-src 'self' https://zenicloud.io https://*.zenicloud.io https://zeniipo.com https://*.zeniipo.com https://*.supabase.co wss://*.supabase.co https://api.anthropic.com https://api.stripe.com https://*.upstash.io https://*.ingest.sentry.io https://vitals.vercel-insights.com; " +
    "frame-src https://js.stripe.com https://*.stripe.com; " +
    "frame-ancestors 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self' https://zenicloud.io https://*.zenicloud.io https://zeniipo.com https://*.zeniipo.com; " +
    "object-src 'none'; " +
    "upgrade-insecure-requests",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy':
    'camera=(), microphone=(), geolocation=(), payment=(self "https://js.stripe.com"), usb=(), magnetometer=(), accelerometer=(), gyroscope=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-XSS-Protection': '1; mode=block',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-site',
  'X-DNS-Prefetch-Control': 'on',
  'X-Permitted-Cross-Domain-Policies': 'none',
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
