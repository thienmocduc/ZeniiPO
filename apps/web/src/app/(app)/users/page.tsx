import { V1Page } from '@/lib/v1/Page';
import { V1DataBind } from '@/components/v1-data-bind';
import { createServerClient } from '@/lib/supabase/server';

// Server-side fetch user_profiles (RLS-scoped to tenant). Pass to V1DataBind
// as initialData → no client refetch, no token round-trip.
export default async function Page() {
  const supabase = await createServerClient();
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('user_id, display_name, full_name, role, tenant_id, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <V1DataBind pageId="page-agents" initialData={{ data: profiles ?? [] }}>
      <V1Page pageId="agents" />
    </V1DataBind>
  );
}
