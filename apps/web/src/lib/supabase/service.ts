import { createClient as createSb, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client — bypasses RLS. ONLY use from server contexts
 * that have already verified caller identity (cron jobs with isAuthorizedCron,
 * webhook handlers with signature verification, etc.).
 *
 * Never expose this client to client components or to API routes that accept
 * unauthenticated user input — a leaked service role key is equivalent to
 * full database admin.
 */
let cached: SupabaseClient | null = null

export function createServiceClient(): SupabaseClient {
  if (cached) return cached
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('SUPABASE service role env missing — cannot create service client')
  }
  cached = createSb(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cached
}
