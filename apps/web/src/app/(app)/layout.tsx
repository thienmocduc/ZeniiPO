import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/sidebar';
import { Topbar } from '@/components/topbar';
import {
  getSidebarInner,
  rewriteSidebarForNextLinks,
} from '@/lib/v1/extract';

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

  // Pull sidebar markup from v1_8 source and rewire <div data-page> → <a href="/route">
  const sidebarHtml = rewriteSidebarForNextLinks(getSidebarInner());

  return (
    <>
      <Topbar user={user} />
      <div className="app">
        <Sidebar html={sidebarHtml} />
        <main className="main">{children}</main>
      </div>
    </>
  );
}
