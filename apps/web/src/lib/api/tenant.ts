import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Resolves the current user's tenant_id from user_profiles.
 * Returns null if not found.
 */
export async function getCurrentTenantId(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('user_profiles')
    .select('tenant_id')
    .eq('id', userId)
    .maybeSingle()
  return (data?.tenant_id as string | undefined) ?? null
}

type RequireResult =
  | { ok: true; user: NonNullable<Awaited<ReturnType<SupabaseClient['auth']['getUser']>>['data']['user']>; tenantId: string }
  | { ok: false; status: 401 | 403; message: string }

/**
 * Returns the current authenticated user + their tenant_id, or a 401/403 response.
 * Use at the top of every authenticated API route to keep auth+tenant boilerplate small.
 */
export async function requireUserAndTenant(supabase: SupabaseClient): Promise<RequireResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, status: 401, message: 'Unauthorized' }
  const tenantId = await getCurrentTenantId(supabase, user.id)
  if (!tenantId) return { ok: false, status: 403, message: 'No tenant for user' }
  return { ok: true, user, tenantId }
}
