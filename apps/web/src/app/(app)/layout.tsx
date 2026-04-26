import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/sidebar';
import { Topbar } from '@/components/topbar';
import { V1Modals } from '@/components/v1-modals';
import { V1Interactivity } from '@/components/v1-interactivity';
import {
  getSidebarInner,
  rewriteSidebarForNextLinks,
} from '@/lib/v1/extract';
import { getV1Script } from '@/lib/v1/getScript';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Onboarding gate: if the tenant has no IPO journey yet, push the user
  // through the 3-step wizard before any app page renders.
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('tenant_id')
    .eq('id', user.id)
    .maybeSingle();
  if (profile?.tenant_id) {
    const { count } = await supabase
      .from('ipo_journeys')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', profile.tenant_id);
    // /onboarding is OUTSIDE this (app) layout, so redirect is loop-safe.
    if ((count ?? 0) === 0) redirect('/onboarding');
  }

  // Pull sidebar markup from v1_8 source and rewire <div data-page> → <a href="/route">
  const sidebarHtml = rewriteSidebarForNextLinks(getSidebarInner());
  // Pull the v1_8 inline <script> block — V1Interactivity executes it once
  // on mount so role switcher, agent modals, drills, command palette,
  // knowledge panels, cascade input, etc. all work.
  const script = getV1Script();

  return (
    <>
      <Topbar user={user} />
      <div className="app">
        <Sidebar html={sidebarHtml} />
        <main className="main">{children}</main>
      </div>
      {/* Modals + overlays (agent modal, cmd palette, training, flash) */}
      <V1Modals />
      {/* Wires up every onclick handler + global function exposed by v1_8 */}
      <V1Interactivity script={script} />
    </>
  );
}
