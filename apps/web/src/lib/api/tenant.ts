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
    .eq('user_id', userId)
    .maybeSingle()
  return (data?.tenant_id as string | undefined) ?? null
}
