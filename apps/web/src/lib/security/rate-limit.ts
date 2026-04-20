import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

const hasUpstash =
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN

if (!hasUpstash) {
  console.warn(
    '[security/rate-limit] UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN missing — rate limiting DISABLED (dev mode).'
  )
}

// NoopRateLimit: always allow in dev (no Upstash configured)
const noopResult = (limit: number): RateLimitResult => ({
  success: true,
  limit,
  remaining: limit,
  reset: Date.now() + 60_000,
})

let publicLimit: Ratelimit | null = null
let authLimit: Ratelimit | null = null
let loginLimit: Ratelimit | null = null
let signupLimit: Ratelimit | null = null

if (hasUpstash) {
  const redis = Redis.fromEnv()

  publicLimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, '1 m'),
    prefix: 'rl:public',
    analytics: true,
  })

  authLimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(120, '1 m'),
    prefix: 'rl:auth',
    analytics: true,
  })

  loginLimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '15 m'),
    prefix: 'rl:login',
    analytics: true,
  })

  signupLimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, '15 m'),
    prefix: 'rl:signup',
    analytics: true,
  })
}

/**
 * Picks the right bucket based on path.
 * - /signup → signupLimit (3/15m)
 * - /login or /api/auth/login → loginLimit (5/15m)
 * - /api/* (non-auth endpoint) authenticated shape → authLimit (120/min)
 * - default → publicLimit (60/min)
 */
function pickLimiter(path: string): { limiter: Ratelimit | null; limit: number } {
  // Signup — strictest
  if (path.startsWith('/signup') || path.startsWith('/api/auth/signup')) {
    return { limiter: signupLimit, limit: 3 }
  }
  // Login submits
  if (
    path.startsWith('/api/auth/login') ||
    path === '/login' ||
    path.startsWith('/login/')
  ) {
    return { limiter: loginLimit, limit: 5 }
  }
  // Authenticated API calls (app/api non-auth)
  if (path.startsWith('/api/') && !path.startsWith('/api/public') && !path.startsWith('/api/health')) {
    return { limiter: authLimit, limit: 120 }
  }
  // Everything else public
  return { limiter: publicLimit, limit: 60 }
}

/**
 * Checks rate limit for a given identifier (usually IP) + path.
 * Returns NoopRateLimit if Upstash is not configured (dev mode).
 */
export async function rateLimit(
  identifier: string,
  path: string
): Promise<RateLimitResult> {
  const { limiter, limit } = pickLimiter(path)

  if (!limiter) {
    return noopResult(limit)
  }

  const { success, limit: l, remaining, reset } = await limiter.limit(identifier)
  return { success, limit: l, remaining, reset }
}
