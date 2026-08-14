import { NextResponse, type NextRequest } from 'next/server';

/**
 * Callback cũ của Supabase (email-confirm / OAuth exchange) — flow đã thay
 * bằng Zeni ID SSO (đăng nhập tại /login, phiên do cookie zeni_session giữ).
 * Link cũ còn trôi nổi trong email → đưa người dùng về /login sạch sẽ.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const redirect = searchParams.get('redirect') || '/dashboard';
  // Chỉ nhận path nội bộ — không tin URL tuyệt đối từ ngoài.
  const safeRedirect = redirect.startsWith('/') ? redirect : '/dashboard';
  const loginUrl = new URL('/login', origin);
  loginUrl.searchParams.set('redirect', safeRedirect);
  return NextResponse.redirect(loginUrl);
}
