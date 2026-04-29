/**
 * Verify a cron request actually came from Vercel's scheduler (and not a
 * random external caller). Vercel sets `x-vercel-cron: 1` on the platform
 * cron invocations and does NOT proxy that header from the public internet.
 *
 * For belt-and-suspenders, we also accept a CRON_SECRET shared secret as a
 * Bearer token so the same endpoints can be triggered manually from `curl`
 * during development without spoofing the Vercel header.
 */
export function isAuthorizedCron(req: Request): boolean {
  const fromVercel = req.headers.get('x-vercel-cron') === '1'
  if (fromVercel) return true

  const auth = req.headers.get('authorization') ?? ''
  const secret = process.env.CRON_SECRET
  if (secret && auth === `Bearer ${secret}`) return true

  return false
}
