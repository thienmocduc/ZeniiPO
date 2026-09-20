import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/zeni/session';
import { isCurrentSuperAdmin } from '@/lib/zeni/superadmin';
import { Sidebar } from '@/components/sidebar';
import { Topbar } from '@/components/topbar';
import { V1Modals } from '@/components/v1-modals';
import { V1Interactivity } from '@/components/v1-interactivity';
import { IdentityBind } from '@/components/identity-bind';
import { AccountMenu } from '@/components/account-menu';
import { ChuThuatNgu } from '@/components/chu-thuat-ngu';
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
  // Phiên Zeni ID (ZIPO-002) — tài khoản hệ sinh thái Zeni, fail-closed.
  const user = await getSessionUser();
  if (!user) {
    redirect('/login');
  }

  // Onboarding gate tạm ngưng tới khi data layer nối DB zeni_ipo (ZIPO-001c):
  // backend Supabase cũ đã bị thu hồi nên không còn nguồn để hỏi journey.

  // Chế độ ADMIN (lệnh chairman): superadmin theo email Zeni ID → thấy Console
  // + toàn quyền mọi tenant Zeni Holdings (RLS bật qua app.is_superadmin).
  //
  // Bản trên `main` trước lần gộp này còn gọi `supabase.rpc('is_chairman_super')`
  // trong khi `supabase` đã bị gỡ khỏi dự án và không hề được import — tức là
  // `main` không build được. Nguồn sự thật nay là `isCurrentSuperAdmin()` (đọc
  // qua Zeni ID, không qua Supabase).
  const showConsole = await isCurrentSuperAdmin();

  // Pull sidebar markup from v1_8 source and rewire <div data-page> → <a href="/route">
  const sidebarHtml = rewriteSidebarForNextLinks(getSidebarInner(), {
    showConsole,
  });
  // Pull the v1_8 inline <script> block — V1Interactivity executes it once
  // on mount so role switcher, agent modals, drills, command palette,
  // knowledge panels, cascade input, etc. all work.
  const script = getV1Script();

  return (
    <>
      <Topbar
        user={{
          email: user.email ?? undefined,
          user_metadata: { name: user.name ?? null },
        }}
      />
      <div className="app">
        <Sidebar html={sidebarHtml} />
        <main className="main">{children}</main>
      </div>
      {/* Modals + overlays (agent modal, cmd palette, training, flash) */}
      <V1Modals />
      {/* Wires up every onclick handler + global function exposed by v1_8 */}
      <V1Interactivity script={script} />
      {/* Patch topbar identity chips with the real logged-in user + tenant */}
      <IdentityBind />
      {/* Nút đăng xuất — trước đây toàn hệ không có đường thoát phiên */}
      <AccountMenu email={user.email} />
      {/* Chú nghĩa tiếng Việt ngay cạnh thuật ngữ chuyên ngành (ARR, term
          sheet, cap table…) — lệnh chairman 20/09: thuật ngữ thì song ngữ,
          tiếng Anh thường thì dịch hẳn. */}
      <ChuThuatNgu />
    </>
  );
}
