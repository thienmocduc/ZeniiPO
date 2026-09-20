import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/zeni/session';
import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';

/**
 * Đã đăng nhập rồi thì đừng bắt đăng nhập lại.
 *
 * Trước đây ai còn phiên mà bấm nhầm vào /login (hoặc mở lại thẻ cũ, hoặc bấm
 * Back) vẫn thấy màn hình đăng nhập trống — dễ tưởng mình bị đá ra. Nay kiểm
 * phiên ngay tại máy chủ và đưa thẳng vào trong.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect: dich } = await searchParams;
  const user = await getSessionUser();
  if (user) {
    // Chỉ nhận đường dẫn nội bộ — không tin URL tuyệt đối từ thanh địa chỉ.
    const an = dich && dich.startsWith('/') && !dich.startsWith('//') ? dich : '/dashboard';
    redirect(an);
  }

  // `Suspense` vì LoginForm đọc `useSearchParams` (tham số ?redirect=).
  return (
    <Suspense fallback={<div style={{ padding: 40, color: '#94A3B8' }}>...</div>}>
      <LoginForm />
    </Suspense>
  );
}
